
const utilities = require('./util/utilities');
const youtubeDownloaderUtilities = require('./util/youtubeDownloaderUtilities');


// Read download task JSON file path input arguments from user
let downloadTaskJsonPath = process.argv[2];
console.info('downloadTaskJsonPath: ' + downloadTaskJsonPath);

if (utilities.isPathExist(downloadTaskJsonPath))
{
  let downloadTask = utilities.readJsonFile(downloadTaskJsonPath);
  
  let downloadTaskReference = translateDownloadTask(downloadTask);
  console.info('downloadTaskReference:');
  console.log(downloadTaskReference);
  
  youtubeDownloaderUtilities.initializeDownloading(downloadTaskReference, true, 'Bulk YouTube Downloader Progress');
}
else
{
  console.error('Error: Input download JSON file path does not exist. Use, for example:');
  console.error('node main.js "input/Template.json"');
}


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
