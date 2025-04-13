import fs from "fs";

class FileService {
    public static saveFile(filePath: string, data: Buffer): Promise<void>;
    public static saveFile(filePath: string, data: Buffer<ArrayBufferLike>): Promise<void>;
    public static saveFile(filePath: string, data: string): Promise<void>;

    
  public static saveFile(filePath: string, data: Buffer | Buffer<ArrayBufferLike> | string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, data, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  public static removeFile(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }



}

export default FileService;
