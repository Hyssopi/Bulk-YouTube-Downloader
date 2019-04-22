
const fs = require('fs');
const ytdl = require('ytdl-core');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
module.exports = ffmpeg;

// From utilities.js
const utilities = {};

/**
 * Sanitize input string to get filename-safe string.
 *
 * @param filename Filename to sanitize
 * @return Sanitized filename-safe string
 */
utilities.getSanitizedFilename = function getSanitizedFilename(filename)
{
  return filename.replace(/[^A-Za-z0-9-_ \[\]()]/g, '_');
}

/**
 * Check if the path exists.
 *
 * @param path Path to check
 * @return True if the path exists in the given path, false if the path does not exist
 */
utilities.isPathExist = function isPathExist(path)
{
  return fs.existsSync(path);
}

/**
 * Write text to a file.
 *
 * @param filePath Path and filename of the file to save
 * @param contents Text to write to file
 */
utilities.writeToFile = function writeToFile(filePath, contents)
{
  fs.writeFile(filePath, contents, function(error)
  {
    if (error)
    {
      return console.error(error);
    }
  });
}

const YOUTUBE_URL_PREFIX = 'https://www.youtube.com/watch?v=';
const STATUS =
{
  PENDING: 'PENDING',
  DOWNLOADING: 'DOWNLOADING',
  DOWNLOADED: 'DOWNLOADED',
  EXISTED: 'EXISTED'
};

let downloadTaskJsonPath = JSON.parse(fs.readFileSync('config/configuration.json', 'utf8'));

let downloadTask = JSON.parse(fs.readFileSync(downloadTaskJsonPath, 'utf8'));

let downloadTaskReference = translateDownloadTask(downloadTask);
console.info('downloadTaskReference:');
console.log(downloadTaskReference);

if (!utilities.isPathExist(downloadTaskReference.outputDirectoryPath))
{
  fs.mkdirSync('./' + downloadTaskReference.outputDirectoryPath);
}

// Start a timed loop that checks whether to start a download entry, checks whether to stop when finished, and generating the progress task HTML
let timer = setInterval(function()
{
  let nextValidIndex = -1;
  let downloadingCount = 0;
  let shouldStop = true;
  for (let i = 0; i < downloadTaskReference.downloadList.length; i++)
  {
    if (nextValidIndex < 0 && downloadTaskReference.downloadList[i].status === STATUS.PENDING)
    {
      nextValidIndex = i;
      shouldStop = false;
    }
    else if (downloadTaskReference.downloadList[i].status === STATUS.DOWNLOADING)
    {
      ++downloadingCount;
      shouldStop = false;
    }
  }
  // If valid, then start downloading
  if (nextValidIndex >= 0 && downloadingCount < downloadTaskReference.parallelDownloadLimit)
  {
    if (downloadTaskReference.downloadList[nextValidIndex].isAudioOnly)
    {
      downloadAudioOnly(downloadTaskReference.audioOnlyFileFormat, downloadTaskReference.outputDirectoryPath, downloadTaskReference.downloadList[nextValidIndex]);
    }
    else
    {
      downloadVideoAudio(downloadTaskReference.videoAudioFileFormat, downloadTaskReference.outputDirectoryPath, downloadTaskReference.downloadList[nextValidIndex]);
    }
  }
  if (shouldStop)
  {
    console.log('Finished downloading. Stopping...');
    clearInterval(timer);
  }
  
  let outputProgressHtml = generateProgressHtml(downloadTaskReference.videoAudioFileFormat, downloadTaskReference.audioOnlyFileFormat, downloadTaskReference.downloadList);
  utilities.writeToFile(downloadTaskReference.outputDirectoryPath + '/' + 'progress.html', outputProgressHtml);
}, 1000);

/**
 * Generate the download task reference from the raw download task data.
 *
 * @param downloadTask Raw download task data
 * @return Download task reference from the raw download task data
 */
function translateDownloadTask(downloadTask)
{
  let downloadTaskReference =
  {
    videoAudioFileFormat: downloadTask.videoAudioFileFormat,
    audioOnlyFileFormat: downloadTask.audioOnlyFileFormat,
    outputDirectoryPath: downloadTask.outputDirectoryPath,
    parallelDownloadLimit: downloadTask.parallelDownloadLimit,
    downloadList: []
  };
  
  for (let i = 0; i < downloadTask.downloadList.length; i++)
  {
    let downloadEntry =
    {
      linkTag: downloadTask.downloadList[i].linkTag,
      isAudioOnly: downloadTask.downloadList[i].isAudioOnly,
      title: '',
      status: STATUS.PENDING,
      downloadTimeDuration: ''
    };
    downloadTaskReference.downloadList.push(downloadEntry);
  }
  
  return downloadTaskReference;
}

/**
 * Start a video/audio download given download entry information and save it to the given output path.
 * Will not download if the file already exists.
 *
 * @param videoAudioFileFormat Video file format
 * @param outputDirectoryPath Path of the directory to save to
 * @param downloadEntry Download entry to download
 */
function downloadVideoAudio(videoAudioFileFormat, outputDirectoryPath, downloadEntry)
{
  downloadEntry.status = STATUS.DOWNLOADING;
  let start = Date.now();
  ytdl.getInfo(YOUTUBE_URL_PREFIX + downloadEntry.linkTag, function(error, info)
  {
    let title = utilities.getSanitizedFilename(info.title);
    downloadEntry.title = title;
    ytdl(YOUTUBE_URL_PREFIX + downloadEntry.linkTag)
      .pipe(
        fs.createWriteStream(outputDirectoryPath + '/' + title + videoAudioFileFormat, {flags: 'wx'})
          .on('error', function(error)
          {
            console.log(title + ' already exists, skipping');
            //console.log(error);
            downloadEntry.status = STATUS.EXISTED;
            downloadEntry.downloadTimeDuration = '-';
          })
      )
      .on('finish', () =>
      {
        let downloadTimeDuration = (Date.now() - start) / 1000;
        console.log('Done downloading: ' + title + ' in ' + downloadTimeDuration + ' seconds');
        downloadEntry.status = STATUS.DOWNLOADED;
        downloadEntry.downloadTimeDuration = downloadTimeDuration.toFixed(3);
      });
  });
}

/**
 * Start an audio only download given download entry information and save it to the given output path.
 * Will not download if the file already exists.
 *
 * @param audioOnlyFileFormat Audio file format
 * @param outputDirectoryPath Path of the directory to save to
 * @param downloadEntry Download entry to download
 */
function downloadAudioOnly(audioOnlyFileFormat, outputDirectoryPath, downloadEntry)
{
  downloadEntry.status = STATUS.DOWNLOADING;
  let start = Date.now();
  let stream = ytdl(YOUTUBE_URL_PREFIX + downloadEntry.linkTag)
    .on('info', (info) =>
    {
      let title = utilities.getSanitizedFilename(info.title);
      downloadEntry.title = title;
      if (!utilities.isPathExist(outputDirectoryPath + '/' + title + audioOnlyFileFormat))
      {
        ffmpeg(stream)
          .audioBitrate(320)
          .save(outputDirectoryPath + '/' + title + audioOnlyFileFormat)
          .on('end', () =>
          {
            let downloadTimeDuration = (Date.now() - start) / 1000;
            console.log('Done downloading: ' + title + ' in ' + downloadTimeDuration + ' seconds');
            downloadEntry.status = STATUS.DOWNLOADED;
            downloadEntry.downloadTimeDuration = downloadTimeDuration.toFixed(3);
          });
      }
      else
      {
        console.log(title + ' already exists, skipping');
        downloadEntry.status = STATUS.EXISTED;
        downloadEntry.downloadTimeDuration = '-';
      }
    });
}

/**
 * Generate HTML code displaying the progress of the download task.
 *
 * @param videoAudioFileFormat Video file format
 * @param audioOnlyFileFormat Audio file format
 * @param downloadList List of items (and related information) to download
 * @return HTML code to display the progress of the download task
 */
function generateProgressHtml(videoAudioFileFormat, audioOnlyFileFormat, downloadList)
{
  let header = `
    <tr style="border-bottom: 4px solid black;">
      <th>#</th>
      <th colspan="2">Link</th>
      <th>File Type</th>
      <th>Title</th>
      <th>Status</th>
      <th>Download Time<br>(seconds)</th>
    </tr>
  `;
  
  let rows = '';
  for (let i = 0; i < downloadList.length; i++)
  {
    let cellColor = '#ECECEC';
    if (downloadList[i].status === STATUS.PENDING)
    {
      cellColor = 'red';
    }
    else if (downloadList[i].status === STATUS.DOWNLOADING)
    {
      cellColor = 'yellow';
    }
    else if (downloadList[i].status === STATUS.DOWNLOADED)
    {
      cellColor = 'green';
    }
    else if (downloadList[i].status === STATUS.EXISTED)
    {
      cellColor = '#1F75FE';
    }
    rows += `
      <tr>
        <td nowrap style="text-align: center;">${i}</td>
        <td nowrap style="text-align: center;"><a target="_blank" href="${YOUTUBE_URL_PREFIX + downloadList[i].linkTag}">[Link]</a></td>
        <td nowrap style="text-align: center;">${downloadList[i].linkTag}</td>
        <td nowrap style="text-align: center;">${downloadList[i].isAudioOnly ? 'Audio (' + audioOnlyFileFormat + ')' : 'Video/Audio (' + videoAudioFileFormat + ')'}</td>
        <td nowrap style="text-align: left;">${downloadList[i].title}</td>
        <td nowrap style="text-align: center; background-color: ${cellColor};">${downloadList[i].status}</td>
        <td nowrap style="text-align: right;">${downloadList[i].downloadTimeDuration}</td>
      </tr>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="2"/>
        <title>Bulk YouTube Downloader Progress</title>
      </head>
      <style>
        th, td
        {
          border: 2px solid #000000;
        }
        th
        {
          background-color: #D3D3D3;
          padding: 10px;
          font-size: 20px;
        }
        td
        {
          background-color: #ECECEC;
          font-size: 18px;
          padding: 4px 20px;
        }
        .hoverRowHighlight tr:hover
        {
          filter: drop-shadow(0px 0px 20px black);
        }
      </style>
      <body>
        <table align="center" style="border-collapse: collapse;">
          <thead>
            ${header}
          </thead>
          <tbody class="hoverRowHighlight">
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `;
}
