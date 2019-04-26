
const fs = require('fs');

const youtubeDownloaderUtilities = require('./util/youtubeDownloaderUtilities');


let downloadTaskJsonPath = JSON.parse(fs.readFileSync('config/configuration.json', 'utf8'));

let downloadTask = JSON.parse(fs.readFileSync(downloadTaskJsonPath, 'utf8'));

let downloadTaskReference = translateDownloadTask(downloadTask);
console.info('downloadTaskReference:');
console.log(downloadTaskReference);

youtubeDownloaderUtilities.initializeDownloading(downloadTaskReference, true, 'Bulk YouTube Downloader Progress');


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
      status: youtubeDownloaderUtilities.STATUS.PENDING,
      downloadTimeDuration: ''
    };
    downloadTaskReference.downloadList.push(downloadEntry);
  }
  
  return downloadTaskReference;
}
