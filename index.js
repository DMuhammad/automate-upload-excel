const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config();

const folderPath = process.env.file_path;

const getLatestExcelFile = (dir) => {
  const files = fs.readdirSync(dir);
  let latestFile = null;
  let latestTime = 0;

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);

    if (stats.isFile() && file.endsWith(".csv")) {
      if (stats.mtime > latestTime) {
        latestTime = stats.mtime;
        latestFile = fullPath;
      }
    }
  });

  return latestFile;
};

const main = () => {
  const startTime = new Date().getTime();
  const latestExcelFile = getLatestExcelFile(folderPath);
  const fileStream = fs.createReadStream(latestExcelFile);
  const form = new FormData();
  form.append("file", fileStream);

  try {
    axios
      .post(process.env.server_url, form, {
        headers: {
          ...form.getHeaders(),
        },
      })
      .then((res) => {
        const endTime = new Date().getTime();
        const processTime = endTime - startTime;
        console.log(
          `File ${path.basename(latestExcelFile)} uploaded: ${
            res.data.data.filename
          }`
        );
        console.log(
          `Success upload mixings data with: ${processTime / 1000} seconds`
        );
        console.log(
          `Wait for ${process.env.delay / 1000} second for next upload...`
        );
      })
      .catch((err) => {
        console.error("err", err.message);
      });
  } catch (error) {
    console.log(err.message);
  }
};

main();

setInterval(() => {
  main();
  console.log(new Date().toLocaleTimeString());
}, process.env.delay);
