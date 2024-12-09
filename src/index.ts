import { Hono } from "hono";
import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("/api/*", async (c, next) => {
  const ACCOUNT_ID = c.env.CLOUDFLARE_ACCOUNT_ID;
  const ACCESS_KEY_ID = c.env.CLOUDFLARE_ACCESS_KEY_ID;
  const SECRET_ACCESS_KEY = c.env.CLOUDFLARE_SECRET_ACCESS_KEY;
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });

  c.set("s3", s3);
  await next();
});

const fetchAllBuckets = async (s3: S3Client) => {
  const command = new ListBucketsCommand({});
  const { Buckets } = await s3.send(command);
  return Buckets;
};

const fetchAllObjects = async (s3: S3Client, bucketName: string) => {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
  });
  const { Contents } = await s3.send(command);
  return Contents;
};

const deleteEventNotification = async (
  env: CloudflareBindings,
  bucketName: string
) => {
  const ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID;
  const ACCESS_TOKEN = env.CLOUDFLARE_ACCESS_TOKEN;

  // fetch all event notifications
  let URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/event_notifications/r2/${bucketName}/configuration`;

  const response = await fetch(URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "cf-r2-jurisdiction": "",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });
  const { result } = await response.json();
  const { queues } = result || [];
  console.log(queues);

  // delete all event notifications
  if (queues) {
    for (const queue of queues) {
      console.log(queue.queueId);
      URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/event_notifications/r2/${bucketName}/configuration/queues/${queue.queueId}`;
      try {
        await fetch(URL, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "cf-r2-jurisdiction": "",
            Authorization: `Bearer ${ACCESS_TOKEN}`,
          },
        });
        console.log(
          `Deleted queue ${queue.queueName} from bucket ${bucketName}`
        );
      } catch (e) {
        console.log(e);
        throw new Error(
          `Failed to delete queue ${queue.queueId} from bucket ${bucketName}`
        );
      }
    }
  }
  return `Deleted event notifications for bucket ${bucketName}`;
};

const fetchAllQueues = async (ACCOUNT_ID: string, ACCESS_TOKEN: string) => {
  let URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/queues`;
  const response = await fetch(URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });
  const { result } = await response.json();
  return result;
};

const fetchAllWorkers = async (ACCOUNT_ID: string, ACCESS_TOKEN: string) => {
  const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts`;
  const response = await fetch(URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });
  const { result } = await response.json();
  return result;
};

const fetchAllMembers = async (ACCESS_TOKEN: string, ACCOUNT_ID: string) => {
  const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/members`;
  const response = await fetch(URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });
  const { result } = await response.json();
  return result;
};

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/api/bucket/list", async (c) => {
  const s3 = c.get("s3") as S3Client;
  return c.json(fetchAllBuckets(s3));
});

// delete  all objects from all the buckets
app.delete("/api/bucket/object", async (c) => {
  const s3 = c.get("s3") as S3Client;
  const buckets = await fetchAllBuckets(s3);
  for (const bucket of buckets) {
    const objects = await fetchAllObjects(s3, bucket.Name);
    console.log(objects);
    if (objects) {
      for (const object of objects) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: bucket.Name,
            Key: object.Key,
          })
        );
      }
    }
  }
  return c.json("Deleted all objects");
});

// Delete all the buckets
app.delete("/api/bucket", async (c) => {
  const s3 = c.get("s3") as S3Client;
  const buckets = await fetchAllBuckets(s3);
  for (const bucket of buckets) {
    // delete all the notifications
    await deleteEventNotification(c.env, bucket.Name);
    // delete all the objects
    const objects = await fetchAllObjects(s3, bucket.Name);
    if (objects) {
      for (const object of objects) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: bucket.Name,
            Key: object.Key,
          })
        );
      }
    }
    await s3.send(
      new DeleteBucketCommand({
        Bucket: bucket.Name,
      })
    );
  }
  return c.json("Deleted all buckets");
});

app.get("/api/queue", async (c) => {
  const ACCESS_TOKEN = c.env.CLOUDFLARE_ACCESS_TOKEN;
  const ACCOUNT_ID = c.env.CLOUDFLARE_ACCOUNT_ID;
  const data = await fetchAllQueues(ACCOUNT_ID, ACCESS_TOKEN);
  console.log(data);
  return c.json(data);
});

app.delete("/api/queue", async (c) => {
  const ACCESS_TOKEN = c.env.CLOUDFLARE_ACCESS_TOKEN;
  const ACCOUNT_ID = c.env.CLOUDFLARE_ACCOUNT_ID;
  const queues = await fetchAllQueues(ACCOUNT_ID, ACCESS_TOKEN);
  if (queues.length > 0) {
    for (const queue of queues) {
      const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/queues/${queue.queue_id}`;
      try {
        await fetch(URL, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ACCESS_TOKEN}`,
          },
        });
      } catch (e) {
        console.log(e);
      }
    }
  }
  return c.json("Deleted all queues");
});

app.get("/api/worker", async (c) => {
  const ACCESS_TOKEN = c.env.CLOUDFLARE_ACCESS_TOKEN;
  const ACCOUNT_ID = c.env.CLOUDFLARE_ACCOUNT_ID;
  const data = await fetchAllWorkers(ACCOUNT_ID, ACCESS_TOKEN);
  return c.json(data);
});

app.delete("/api/worker", async (c) => {
  const ACCESS_TOKEN = c.env.CLOUDFLARE_ACCESS_TOKEN;
  const ACCOUNT_ID = c.env.CLOUDFLARE_ACCOUNT_ID;
  const workers = await fetchAllWorkers(ACCOUNT_ID, ACCESS_TOKEN);
  if (workers.length > 0) {
    for (const worker of workers) {
      const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${worker.id}`;
      try {
        await fetch(URL, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ACCESS_TOKEN}`,
          },
        });
      } catch (e) {
        console.log(e);
      }
    }
  }
  return c.json("Deleted all workers");
});

// Get all members
app.get("/api/member", async (c) => {
  const members = await fetchAllMembers(
    c.env.CLOUDFLARE_ACCESS_TOKEN,
    c.env.CLOUDFLARE_ACCOUNT_ID
  );
  return c.json(members);
});

// Delete members
app.delete("/api/member", async (c) => {
  const members = await fetchAllMembers(
    c.env.CLOUDFLARE_ACCESS_TOKEN,
    c.env.CLOUDFLARE_ACCOUNT_ID
  );
  const { emails } = await c.req.json();
  for (const member of members) {
    if (!emails.includes(member.user.email)) {
      const URL = `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/members/${member.id}`;
      try {
        await fetch(URL, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${c.env.CLOUDFLARE_ACCESS_TOKEN}`,
          },
        });
      } catch (e) {
        console.log(e);
      }
    }
  }
  return c.json("Deleted all members");
});

export default app;
