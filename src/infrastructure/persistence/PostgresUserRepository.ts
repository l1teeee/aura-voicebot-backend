import type { Pool, QueryResultRow } from 'pg';
import { User } from '../../domain/entities/User';
import type { UserInteraction } from '../../domain/entities/User';
import type { UserRepository } from '../../domain/ports/UserRepository';

const FIND_USER_BY_NAME_QUERY = `
  SELECT
    u.id AS user_id,
    u.name AS user_name,
    s.id AS session_id,
    s.started_at AS session_started_at,
    i.id AS interaction_id,
    i.user_message,
    i.bot_reply,
    i.created_at AS interaction_created_at
  FROM users AS u
  LEFT JOIN sessions AS s ON s.user_id = u.id
  LEFT JOIN interactions AS i ON i.session_id = s.id
  WHERE u.name_key = $1
  ORDER BY s.started_at ASC NULLS LAST, s.id ASC NULLS LAST,
    i.created_at ASC NULLS LAST, i.id ASC NULLS LAST
`;

const CREATE_USER_QUERY = `
  INSERT INTO users (name, name_key)
  VALUES ($1, $2)
  RETURNING id AS user_id, name AS user_name
`;

const SAVE_SESSION_QUERY = `
  INSERT INTO sessions (id, user_id, started_at)
  VALUES ($1, $2, $3)
  ON CONFLICT (id) DO UPDATE
  SET user_id = sessions.user_id
  WHERE sessions.user_id = EXCLUDED.user_id
`;

const SAVE_INTERACTION_QUERY = `
  INSERT INTO interactions (session_id, user_message, bot_reply, created_at)
  VALUES ($1, $2, $3, $4)
`;

interface UserRow extends QueryResultRow {
  readonly user_id: string;
  readonly user_name: string;
  readonly session_id: string | null;
  readonly session_started_at: Date | string | null;
  readonly interaction_id: string | null;
  readonly user_message: string | null;
  readonly bot_reply: string | null;
  readonly interaction_created_at: Date | string | null;
}

interface CreatedUserRow extends QueryResultRow {
  readonly user_id: string;
  readonly user_name: string;
}

interface MutableUserConversation {
  readonly sessionId: string;
  readonly startedAt: Date;
  readonly interactions: UserInteraction[];
}

const toDate = (value: Date | string): Date =>
  value instanceof Date ? new Date(value.getTime()) : new Date(value);

const mapUserRows = (firstRow: UserRow, rows: readonly UserRow[]): User => {
  const conversations: MutableUserConversation[] = [];
  let currentConversation: MutableUserConversation | null = null;

  for (const row of rows) {
    if (row.session_id !== null && row.session_started_at !== null) {
      if (currentConversation === null || currentConversation.sessionId !== row.session_id) {
        currentConversation = {
          sessionId: row.session_id,
          startedAt: toDate(row.session_started_at),
          interactions: []
        };
        conversations.push(currentConversation);
      }
    }

    if (
      currentConversation !== null &&
      row.interaction_id !== null &&
      row.user_message !== null &&
      row.bot_reply !== null &&
      row.interaction_created_at !== null
    ) {
      currentConversation.interactions.push({
        userMessage: row.user_message,
        botReply: row.bot_reply,
        createdAt: toDate(row.interaction_created_at)
      });
    }
  }

  return User.fromPersistence(firstRow.user_id, firstRow.user_name, conversations);
};

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async findByName(name: string): Promise<User | null> {
    const normalizedName = name.trim().toLowerCase();
    const result = await this.pool.query<UserRow>(FIND_USER_BY_NAME_QUERY, [normalizedName]);
    const firstRow = result.rows[0];

    return firstRow === undefined ? null : mapUserRows(firstRow, result.rows);
  }

  async create(name: string): Promise<User> {
    const normalizedName = name.trim().toLowerCase();
    const result = await this.pool.query<CreatedUserRow>(CREATE_USER_QUERY, [
      normalizedName,
      normalizedName
    ]);
    const firstRow = result.rows[0];

    if (firstRow === undefined) {
      throw new Error('La creación del usuario no devolvió ningún registro.');
    }

    return User.fromPersistence(firstRow.user_id, firstRow.user_name, []);
  }

  async saveInteraction(
    userId: string,
    sessionId: string,
    userMessage: string,
    botReply: string,
    createdAt: Date
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const sessionResult = await client.query(SAVE_SESSION_QUERY, [sessionId, userId, createdAt]);

      if (sessionResult.rowCount === 0) {
        throw new Error('La sesión ya pertenece a otro usuario.');
      }

      await client.query(SAVE_INTERACTION_QUERY, [sessionId, userMessage, botReply, createdAt]);
      await client.query('COMMIT');
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
