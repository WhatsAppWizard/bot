import Database from "./index";
import { Stickers } from "../../generated/prisma";

class StickersService {
  async create(
    userId: string,
    sentAt: Number,
    body: string
  ): Promise<Stickers> {
    const prisma = await Database.GetClient();
    return prisma.stickers.create({
      data: {
        userId,
        sentAt,
        body,
      },
    });
  }

  async getById(id: string): Promise<Stickers | null> {
    const prisma = await Database.GetClient();
    return prisma.stickers.findUnique({
      where: { id },
    });
  }

  async getByUserId(userId: string): Promise<Stickers[]> {
    const prisma = await Database.GetClient();
    return prisma.stickers.findMany({
      where: { userId },
    });
  }

  async deleteByUserId(userId: string): Promise<{ count: number }> {
    const prisma = await Database.GetClient();
    return prisma.stickers.deleteMany({
      where: { userId },
    });
  }
}

export default StickersService;
