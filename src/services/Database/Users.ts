import Database from ".";
import { User } from "../../generated/prisma";
import { PrismaClient } from "../../generated/prisma/client";

class Users {
  private prisma: PrismaClient;
  constructor() {
    this.prisma = Database.GetClient();
  }

  public async getUserByPhone(phone: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        phone,
      },
    });
    return user;
  }

  private async getUserById(userId: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    return user;
  }

  public async createUser(user: Partial<User>): Promise<User> {
    const incoming_user = user as User;
    const isExisted = await this.getUserByPhone(incoming_user.phone);
    if (isExisted) {
      return await this.updateUser(isExisted.id, user);
    }
    return await this.prisma.user.create({
      data: incoming_user,
    });
  }

  private async updateUser(userId:string, user: Partial<User>): Promise<User> {
 
    return await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: user,
    });
  }
  public async getUser(phone: string): Promise<User | null> {
    
    const user = await this.prisma.user.findFirst({
      where: {
        phone,
      },
    });
    return user;
  }
}

export default Users;
