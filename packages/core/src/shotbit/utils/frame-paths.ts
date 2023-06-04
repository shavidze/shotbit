import { mkdir, readdir, rm } from 'fs/promises';
import path from 'node:path';
import ffmpeg from '../../ffmpeg/index.js';

const __dirname = new URL('.', import.meta.url).pathname;

async function getCachedDirectoryNames(): Promise<string[]> {
  const directoryContent = await readdir(__dirname, { withFileTypes: true });

  const directoryNames = directoryContent
    .filter(
      (dirent) => dirent.isDirectory() && dirent.name.startsWith('shotbit'),
    )
    .map((dirent) => dirent.name);

  return directoryNames;
}

async function deleteOldCachedDirectories() {
  const directoryNames = await getCachedDirectoryNames();

  for (const cachedDirectory of directoryNames) {
    const [cachedTimeStamp] = cachedDirectory.split('-')[1];

    const cachedDate = new Date(Number(cachedTimeStamp));

    if (new Date().getDate() - cachedDate.getDate() >= 1) {
      await rm(path.join(__dirname, cachedDirectory), {
        force: true,
        recursive: true,
      });
    }
  }
}

async function findCachedDirectory(
  videoName: string,
): Promise<string | undefined> {
  await deleteOldCachedDirectories();

  const directoryNames = await getCachedDirectoryNames();

  const cachedDirectory = directoryNames.find(
    (directoryName) => directoryName.split('-')[2] === videoName,
  );

  return cachedDirectory ? path.join(__dirname, cachedDirectory) : undefined;
}

async function createFramesDirectory(videoName: string): Promise<string> {
  const directoryName = `shotbit-${Date.now().toString()}-${videoName}`;
  const framesDirectory = path.join(__dirname, directoryName);
  await mkdir(framesDirectory);

  return framesDirectory;
}

export async function extractFrames(videoPath: string): Promise<string[]> {
  const videoName = path.basename(videoPath);

  let framesDirectory: string;
  const cachedDirectory: string | undefined = await findCachedDirectory(
    videoName,
  );

  if (cachedDirectory) {
    framesDirectory = cachedDirectory;
  } else {
    framesDirectory = await createFramesDirectory(videoName);
    await ffmpeg.extractFrames(videoPath, framesDirectory);
  }

  const paths = (await readdir(framesDirectory))
    .map((framePath) => path.join(framesDirectory, framePath))
    .sort((a, b) => {
      a = path.basename(a);
      b = path.basename(b);

      const [aNumber] = a.match(/\d+/) as RegExpMatchArray;
      const [bNumber] = b.match(/\d+/) as RegExpMatchArray;

      return Number(aNumber) - Number(bNumber);
    });

  return paths;
}
