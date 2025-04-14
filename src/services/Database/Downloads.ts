import { PrismaClient } from "@prisma/client";
import Database from ".";
import { DownloadStatus } from "../../generated/prisma";

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
      return await this.prisma.downloads.findUnique({
        where: { url },
      });
    }
    async create(url: string, platform: string, userId:string, sentAt: string) {
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
   
}

export default DownloadRepository;