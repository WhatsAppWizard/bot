import { PrismaClient } from "../../generated/prisma";

class ErrorsRepository {
  private readonly prisma: PrismaClient;
  constructor() {
    this.prisma = new PrismaClient();
  }
  async createError(error: string, downloadId: string) {
    return await this.prisma.errors.create({
      data: { error, downloadId },
    });
  }
  async findById(id: string) {
    return await this.prisma.errors.findUnique({
      where: { id },
    });
  }
}


export default ErrorsRepository;