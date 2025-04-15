import { PrismaClient } from "../../generated/prisma";
import Database from ".";
import { Downloads, DownloadStatus } from "../../generated/prisma";

class DownloadRepository { 
    private prisma: PrismaClient;
    constructor() {
      this.prisma = Database.GetClient();
    }

    async findById(id: string) {
      return await this.prisma.downloads.findUnique({
        where: { id },
      });
    }
    async findByUrl(url: string) {
      return await this.prisma.downloads.findMany({
        where: { urlFromUser: url },
      });
    }
    async create(url: string, platform: string, userId:string, sentAt: number) {
      return await this.prisma.downloads.create({
        data: { urlFromUser: url, platform, userId,sentAt},
      });
    }   

    async updateStatusById(id: string, status: DownloadStatus) {
        return await this.prisma.downloads.update({
            where: { id },
            data: { status },
        });
    }

    async updateDownloadById(id: string, update: Partial<Downloads>) {
        return await this.prisma.downloads.update({
            where: { id },
            data: update,
        });
    }
   
}

export default DownloadRepository;