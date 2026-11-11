import "reflect-metadata";
import { config } from "dotenv";
config({ path: "../../.env" });
config();
import { NestFactory } from "@nestjs/core";
import {
  Module,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  OnModuleDestroy,
  Inject,
} from "@nestjs/common";
import { PrismaClient, Prisma, Item } from "@prisma/client";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Bot } from "grammy";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Request } from "express";
import { verifyTelegram } from "./auth";

const input = z.object({
  type: z.enum(["link", "text", "photo", "video"]),
  title: z.string().trim().min(1).max(300),
  text: z.string().max(20000).default(""),
  url: z
    .string()
    .url()
    .max(2000)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v)),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  collectionId: z.string().nullable().optional(),
  mediaKey: z.string().optional(),
  mime: z.string().optional(),
});
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new BadRequestException(r.error.flatten());
  return r.data;
}
function source(url?: string) {
  return url ? new URL(url).hostname.replace(/^www\./, "") : "";
}
@Injectable()
class Store extends PrismaClient implements OnModuleDestroy {
  bot?: Bot;
  async onModuleDestroy() {
    if (this.bot?.isRunning()) await this.bot.stop();
    await this.$disconnect();
  }
  s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
  });
  bucket = process.env.S3_BUCKET || "save";
  private storageReady?: Promise<void>;
  ensureStorage() {
    this.storageReady ??= this.initializeStorage().catch((error) => {
      this.storageReady = undefined;
      throw error;
    });
    return this.storageReady;
  }
  private async initializeStorage() {
    await this.s3
      .send(new HeadBucketCommand({ Bucket: this.bucket }))
      .catch(async () => {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      });
    await this.s3
      .send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: [
                  process.env.WEB_ORIGIN || "http://localhost:5173",
                ],
                AllowedMethods: ["PUT", "GET", "HEAD"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag"],
                MaxAgeSeconds: 300,
              },
            ],
          },
        }),
      )
      .catch((error: Error) => {
        // MinIO configures CORS at server level via MINIO_API_CORS_ALLOW_ORIGIN.
        if (error.name !== "NotImplemented") throw error;
      });
  }
  async authenticate(req: Request) {
    const raw = req.headers.authorization?.replace(/^tma /, "");
    let identity: { id: number; first_name: string };
    try {
      if (raw && process.env.BOT_TOKEN)
        identity = verifyTelegram(raw, process.env.BOT_TOKEN);
      else if (
        process.env.DEV_AUTH === "true" &&
        process.env.NODE_ENV !== "production"
      )
        identity = { id: 1, first_name: "Локальный пользователь" };
      else throw new Error();
    } catch {
      throw new UnauthorizedException(
        "Откройте приложение заново через Telegram",
      );
    }
    return this.userUpsert(identity.id, identity.first_name);
  }
  userUpsert(id: number, name: string) {
    return this.user.upsert({
      where: { telegramId: String(id) },
      update: {},
      create: { telegramId: String(id), name },
    });
  }
  async collectionOwned(userId: string, id?: string | null) {
    if (id && !(await this.collection.findFirst({ where: { id, userId } })))
      throw new NotFoundException("Коллекция не найдена");
  }
  async view(item: Item) {
    return {
      ...item,
      mediaUrl: item.mediaKey
        ? await getSignedUrl(
            this.s3,
            new GetObjectCommand({ Bucket: this.bucket, Key: item.mediaKey }),
            { expiresIn: 900 },
          )
        : null,
    };
  }
}
@Controller("api")
class Api {
  constructor(@Inject(Store) private readonly db: Store) {}
  @Get("health") health() {
    return { ok: true };
  }
  @Get("me") me(@Req() req: Request) {
    return this.db.authenticate(req);
  }
  @Get("collections") async collections(@Req() req: Request) {
    const u = await this.db.authenticate(req);
    return this.db.collection.findMany({
      where: { userId: u.id },
      include: { _count: { select: { items: true } } },
      orderBy: { name: "asc" },
    });
  }
  @Post("collections") async collection(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    const u = await this.db.authenticate(req);
    const { name } = parse(
      z.object({ name: z.string().trim().min(1).max(80) }),
      body,
    );
    return this.db.collection.upsert({
      where: { userId_name: { userId: u.id, name } },
      create: { userId: u.id, name },
      update: {},
    });
  }
  @Get("items") async items(
    @Req() req: Request,
    @Query() q: Record<string, string>,
  ) {
    const u = await this.db.authenticate(req);
    const where: Prisma.ItemWhereInput = { userId: u.id };
    if (q.type) where.type = q.type;
    if (q.collection)
      where.collectionId = q.collection === "inbox" ? null : q.collection;
    if (q.tag) where.tags = { has: q.tag };
    if (q.q)
      where.OR = ["title", "text", "source"].map((k) => ({
        [k]: { contains: q.q, mode: "insensitive" },
      }));
    const rows = await this.db.item.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 41,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: { collection: true },
    });
    return {
      items: await Promise.all(rows.slice(0, 40).map((i) => this.db.view(i))),
      nextCursor: rows.length > 40 ? rows[39].id : null,
    };
  }
  @Post("items") async add(@Req() req: Request, @Body() body: unknown) {
    const u = await this.db.authenticate(req);
    const data = parse(input, body);
    await this.db.collectionOwned(u.id, data.collectionId);
    if (data.type === "link" && !data.url)
      throw new BadRequestException("Укажите ссылку");
    if (["photo", "video"].includes(data.type) && !data.mediaKey)
      throw new BadRequestException("Загрузите файл");
    if (data.mediaKey) {
      if (await this.db.item.findFirst({ where: { mediaKey: data.mediaKey } }))
        throw new BadRequestException("Этот файл уже сохранён");
      if (!data.mediaKey.startsWith(`${u.id}/`))
        throw new BadRequestException("Неверный файл");
      const meta = await this.db.s3
        .send(
          new HeadObjectCommand({ Bucket: this.db.bucket, Key: data.mediaKey }),
        )
        .catch(() => {
          throw new BadRequestException("Файл не загружен");
        });
      const kind = meta.ContentType?.split("/")[0];
      if (
        (data.type === "photo" && kind !== "image") ||
        (data.type === "video" && kind !== "video") ||
        !["photo", "video"].includes(data.type)
      )
        throw new BadRequestException("Тип файла не совпадает с карточкой");
      data.mime = meta.ContentType;
      if ((meta.ContentLength || 0) > 20 * 1024 * 1024)
        throw new BadRequestException("Максимальный размер файла — 20 МБ");
    }
    if (data.url) {
      const existing = await this.db.item.findFirst({
        where: { userId: u.id, url: data.url },
      });
      if (existing) return this.db.view(existing);
    }
    return this.db.view(
      await this.db.item.create({
        data: { ...data, userId: u.id, source: source(data.url) },
      }),
    );
  }
  @Patch("items/:id") async edit(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const u = await this.db.authenticate(req);
    const data = parse(
      input
        .pick({ title: true, text: true, tags: true, collectionId: true })
        .partial(),
      body,
    );
    await this.db.collectionOwned(u.id, data.collectionId);
    const result = await this.db.item.updateMany({
      where: { id, userId: u.id },
      data,
    });
    if (!result.count) throw new NotFoundException();
    return { ok: true };
  }
  @Delete("items/:id") async remove(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    const u = await this.db.authenticate(req);
    const item = await this.db.item.findFirst({ where: { id, userId: u.id } });
    if (!item) throw new NotFoundException();
    if (item.mediaKey)
      await this.db.s3.send(
        new DeleteObjectCommand({ Bucket: this.db.bucket, Key: item.mediaKey }),
      );
    await this.db.item.delete({ where: { id } });
    return { ok: true };
  }
  @Post("uploads") async upload(@Req() req: Request, @Body() body: unknown) {
    const u = await this.db.authenticate(req);
    const { mime, size } = parse(
      z.object({
        mime: z.enum([
          "image/jpeg",
          "image/png",
          "image/webp",
          "video/mp4",
          "video/webm",
        ]),
        size: z
          .number()
          .int()
          .positive()
          .max(20 * 1024 * 1024),
      }),
      body,
    );
    await this.db.ensureStorage();
    const key = `${u.id}/${randomUUID()}`;
    return {
      key,
      url: await getSignedUrl(
        this.db.s3,
        new PutObjectCommand({
          Bucket: this.db.bucket,
          Key: key,
          ContentType: mime,
          ContentLength: size,
        }),
        { expiresIn: 300 },
      ),
    };
  }
}
@Module({ controllers: [Api], providers: [Store] })
class App {}
async function bootstrap() {
  const app = await NestFactory.create(App);
  app.enableCors({ origin: process.env.WEB_ORIGIN || "http://localhost:5173" });
  app.enableShutdownHooks();
  const db = app.get(Store);
  await db.$connect();
  if (process.env.BOT_TOKEN && process.env.BOT_POLLING !== "false") {
    const bot = new Bot(process.env.BOT_TOKEN);
    db.bot = bot;
    bot.command("start", (ctx) =>
      ctx.reply(
        "Ссылки, идеи и вдохновение — в одном месте. Пришлите ссылку, текст, фото или видео.",
        process.env.MINI_APP_URL
          ? {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Открыть Save",
                      web_app: { url: process.env.MINI_APP_URL },
                    },
                  ],
                ],
              },
            }
          : {},
      ),
    );
    bot.on("message", async (ctx) => {
      const msg = ctx.message;
      if (!ctx.from) return;
      const u = await db.userUpsert(ctx.from.id, ctx.from.first_name);
      const eventId = `${ctx.chat.id}:${msg.message_id}`;
      if (await db.item.findUnique({ where: { telegramMessageId: eventId } }))
        return;
      const media = msg.photo?.at(-1) || msg.video;
      const text = msg.text || msg.caption || "";
      const match = text.match(/https?:\/\/[^\s]+/);
      let key: string | undefined;
      let mime: string | undefined;
      try {
        if (media) {
          if ((media.file_size || 0) > 20 * 1024 * 1024) {
            await ctx.reply(
              "Пока принимаю файлы до 20 МБ. Можно сохранить ссылку.",
            );
            return;
          }
          await db.ensureStorage();
          const file = await ctx.api.getFile(media.file_id);
          const res = await fetch(
            `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`,
            { signal: AbortSignal.timeout(30000) },
          );
          if (!res.ok) throw new Error("download");
          const bytes = Buffer.from(await res.arrayBuffer());
          if (bytes.length > 20 * 1024 * 1024) throw new Error("size");
          mime = msg.video?.mime_type || "image/jpeg";
          key = `${u.id}/${randomUUID()}`;
          await db.s3.send(
            new PutObjectCommand({
              Bucket: db.bucket,
              Key: key,
              Body: bytes,
              ContentType: mime,
            }),
          );
        }
        if (!media && !text) return;
        await db.item.create({
          data: {
            userId: u.id,
            type: msg.photo
              ? "photo"
              : msg.video
                ? "video"
                : match
                  ? "link"
                  : "text",
            title: text.slice(0, 160) || (msg.video ? "Видео" : "Фото"),
            text,
            url: match?.[0],
            source: source(match?.[0]),
            mediaKey: key,
            mime,
            telegramMessageId: eventId,
          },
        });
        await ctx.reply("Сохранено во входящие ✓");
      } catch {
        await ctx.reply("Не удалось сохранить. Попробуйте ещё раз.");
      }
    });
    bot.catch(() => console.error("Telegram update failed"));
    void bot.start();
  }
  await app.listen(
    Number(process.env.PORT || 3000),
    process.env.HTTP_HOST || "127.0.0.1",
  );
}
bootstrap().catch(() => {
  console.error(
    "Startup failed: check database, S3 and environment configuration",
  );
  process.exit(1);
});
