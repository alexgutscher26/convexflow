import { MongoClient, Db } from "mongodb";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "convexflow";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Handle serverless / hot-reloads caching in Node/Next
  const globalWithMongo = global as typeof globalThis & {
    _mongoClient?: MongoClient;
    _mongoDb?: Db;
  };

  if (process.env.NODE_ENV === "development") {
    if (!globalWithMongo._mongoClient) {
      const client = new MongoClient(MONGO_URL);
      await client.connect();
      globalWithMongo._mongoClient = client;
      globalWithMongo._mongoDb = client.db(DB_NAME);
      await setupIndexes(globalWithMongo._mongoDb);
    }
    cachedClient = globalWithMongo._mongoClient || null;
    cachedDb = globalWithMongo._mongoDb || null;
  } else {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    cachedClient = client;
    cachedDb = client.db(DB_NAME);
    await setupIndexes(cachedDb);
  }

  return { client: cachedClient!, db: cachedDb! };
}

export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

async function setupIndexes(db: Db) {
  console.log("Initializing full-text and TTL indexes in MongoDB...");
  
  // 1. Projects Full-Text Index
  try {
    await db.collection("projects").createIndex(
      { name: "text", description: "text" },
      {
        weights: { name: 10, description: 5 },
        name: "projects_text_index",
      }
    );
  } catch (err) {
    try {
      await db.collection("projects").dropIndex("projects_text_index");
      await db.collection("projects").createIndex(
        { name: "text", description: "text" },
        {
          weights: { name: 10, description: 5 },
          name: "projects_text_index",
        }
      );
    } catch (dropErr) {
      console.warn("Could not setup projects text index:", dropErr);
    }
  }

  // 2. Nodes Full-Text Index
  try {
    await db.collection("nodes").createIndex(
      { title: "text", content: "text" },
      {
        weights: { title: 10, content: 5 },
        name: "nodes_text_index",
      }
    );
  } catch (err) {
    try {
      await db.collection("nodes").dropIndex("nodes_text_index");
      await db.collection("nodes").createIndex(
        { title: "text", content: "text" },
        {
          weights: { title: 10, content: 5 },
          name: "nodes_text_index",
        }
      );
    } catch (dropErr) {
      console.warn("Could not setup nodes text index:", dropErr);
    }
  }

  // 3. Performance Indexes
  try {
    await db.collection("projects").createIndex({ owner_id: 1 });
    await db.collection("nodes").createIndex({ project_id: 1 });
    await db.collection("refresh_tokens").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
    await db.collection("refresh_tokens").createIndex({ user_id: 1 });
    console.log("Indexes initialized successfully.");
  } catch (err) {
    console.error("Error setting up supporting indexes:", err);
  }
}
