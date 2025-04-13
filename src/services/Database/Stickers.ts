import Database from "./index";
import { PrismaClient } from "@prisma/client";
import { Stickers } from "../../generated/prisma";

class StickerRepository {
  private prisma: PrismaClient;
  constructor() {
    this.prisma = Database.GetClient();
  }
  async create(
    userId: string,
    sentAt: Number,
    body: string
  ): Promise<Stickers> {
    return this.prisma.stickers.create({
      data: {
        userId,
        sentAt: Number(sentAt),
        body,
      },
    });
  }

  async getById(id: string): Promise<Stickers | null> {
    return this.prisma.stickers.findUnique({
      where: { id },
    });
  }

  async getByUserId(userId: string): Promise<Stickers[]> {
    return this.prisma.stickers.findMany({
      where: { userId },
    });
  }

  async deleteByUserId(userId: string): Promise<{ count: number }> {
    return this.prisma.stickers.deleteMany({
      where: { userId },
    });
  }
}

export default StickerRepository;
