const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const chalk = require("chalk");
const moment = require("moment");
require("dotenv").config();

const folderPath = process.env.file_path;
const delay = parseInt(process.env.delay) || 3600000;
const serverUrl = process.env.server_url;
const MAX_RETRIES = 3;
let retryCount = 0;

const log = (color, message) => {
  const timestamp = moment().format("DD/MM/YY HH:mm:ss");
  console.log(chalk[color](`[${timestamp}] ${message}`));
};

const getLatestExcelFile = (dir) => {
  try {
    return fs
      .readdirSync(dir)
      .filter((file) => file.endsWith(".csv"))
      .map((file) => ({
        path: path.join(dir, file),
        stats: fs.statSync(path.join(dir, file)),
      }))
      .filter((file) => file.stats.isFile())
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs)[0]?.path;
  } catch (error) {
    log("red", `Directory read error: ${error.message}`);
    return null;
  }
};

const scheduleNextUpload = (callback) => {
  setTimeout(() => {
    main().catch((error) => {
      log("error", `Scheduled upload error: ${error.message}`);
    });
  }, delay);
  // const delay = process.env.delay;
  // setTimeout(callback, delay);
};

const main = async () => {
  try {
    // Validate env
    if (!serverUrl)
      throw new Error("SERVER_URL environment variable is not set!");

    // Get latest CSV file
    const startTime = Date.now();
    const latestCSVFile = getLatestExcelFile(folderPath);

    if (!latestCSVFile) {
      log("yellow", "No CSV files found in directory");
      scheduleNextUpload();
      return;
    }

    log(
      "green",
      `Found file: ${path.basename(
        latestCSVFile
      )}. Waiting for preparing form data...`
    );

    // Validate file size
    // const fileStats = fs.statSync(latestCSVFile);
    // if (fileStats.size > 10 * 1024 * 1024) {
    //   log(
    //     "yellow",
    //     `File too large: ${(fileStats.size / 1024 / 1024).toFixed(2)}MB`
    //   );
    //   scheduleNextUpload();
    //   return;
    // }

    // Prepare form data
    const fileStream = fs.createReadStream(latestCSVFile);
    fileStream.on("error", (err) => {
      throw new Error(`File read error: ${err.message}`);
    });

    log("green", `Wait for uploading...`);

    const form = new FormData();
    form.append("file", fileStream);

    // Upload file
    const response = await axios.post(process.env.server_url, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    // Log success
    const processTime = Date.now() - startTime;
    log(
      "green",
      `File ${path.basename(latestCSVFile)} uploaded: ${
        response.data.data.filename
      }`
    );
    log(
      "green",
      `Success upload mixings data with: ${processTime / 1000} seconds`
    );
    log(
      "blue",
      `Waiting ${delay / 1000} seconds before processing next upload...`
    );

    retryCount = 0;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || error.message;
      log("red", `Server Error: ${errorMessage}`);
      return;
    } else if (error instanceof Error) {
      log("red", `Unexpected Error: ${error.message}`);
    } else {
      log("red", `An unknown error occurred`);
    }

    // Retry logic
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      log("yellow", `Retrying... (Attempt ${retryCount}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, 5000));

      return main();
    } else {
      log("red", "Max retries reached. Stopping...");
      process.exit(1);
    }
  }

  scheduleNextUpload(() => main());
};

main().catch((error) => {
  log("red", `Unhandled error: ${error.message}`);
  process.exit(1);
});
