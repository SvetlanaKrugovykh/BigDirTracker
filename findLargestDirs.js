// findLargestDirs.js

const fs = require('fs').promises
const fsSync = require('fs') // For synchronous file operations (logging)
const path = require('path')

const { IGNORED_FILES, IGNORED_DIRS } = require('./ignored_file_list.js')

const MAX_CONCURRENT = 20
let currentConcurrent = 0
const queue = []

const MIN_SIZE_THRESHOLD = 1 * 1024 * 1024 * 512 // 512 MB

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject })
    processQueue()
  })
}

function processQueue() {
  while (currentConcurrent < MAX_CONCURRENT && queue.length > 0) {
    const { fn, resolve, reject } = queue.shift()
    currentConcurrent++
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        currentConcurrent--
        processQueue()
      })
  }
}

function logError(message) {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`
  fsSync.appendFile('error.log', logMessage, (err) => {
    if (err) {
      console.error('Failed to write to error.log:', err)
    }
  })
}

async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath)
    return stats.size
  } catch (err) {
    logError(`Error getting file size for ${filePath}: ${err.message}`)
    return 0
  }
}

async function getDirectorySize(dirPath, dirSizes) {
  let totalSize = 0
  try {
    console.log(`Processing directory: ${dirPath}`)
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const tasks = entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name)
      const entryNameLower = entry.name.toLowerCase()

      // Skip ignored files
      if (entry.isFile() && IGNORED_FILES.has(entryNameLower)) {
        console.log(`Skipping ignored file: ${fullPath}`)
        return
      }

      if (entry.isDirectory() && IGNORED_DIRS.has(entryNameLower)) {
        console.log(`Skipping ignored directory: ${fullPath}`)
        return
      }

      if (entry.isDirectory()) {
        try {
          const size = await getDirectorySize(fullPath, dirSizes)
          totalSize += size
        } catch (err) {
          logError(`Error processing directory ${fullPath}: ${err.message}`)
        }
      } else if (entry.isFile()) {
        try {
          const size = await getFileSize(fullPath)
          totalSize += size
        } catch (err) {
          logError(`Error processing file ${fullPath}: ${err.message}`)
        }
      } else {
        console.log(`Skipping non-file, non-directory entry: ${fullPath}`)
      }
    })

    await Promise.all(tasks)
    if (totalSize >= MIN_SIZE_THRESHOLD) {
      dirSizes.set(dirPath, totalSize)
      console.log(`Finished processing directory: ${dirPath} - Total Size: ${(totalSize / (1024 ** 3)).toFixed(2)} GB`)
    } else {
      console.log(`Skipping directory: ${dirPath} - Total Size below threshold: ${(totalSize / (1024 ** 3)).toFixed(2)} GB`)
    }
    return totalSize
  } catch (err) {
    logError(`Error accessing directory ${dirPath}: ${err.message}`)
    return 0
  }
}

async function findLargestDirectories(topDir, topN = 10) {
  const dirSizes = new Map()
  console.log(`Starting directory traversal: ${topDir}`)
  const startTime = Date.now()

  await getDirectorySize(topDir, dirSizes)

  const sortedDirs = Array.from(dirSizes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)

  const endTime = Date.now()

  const results =
    `Top ${topN} Largest Directories:\n` +
    sortedDirs
      .map(
        ([dir, size], index) =>
          `${index + 1}. ${dir} - ${(size / (1024 ** 3)).toFixed(2)} GB`
      )
      .join('\n') +
    `\n\nExecution Time: ${((endTime - startTime) / 1000).toFixed(2)} seconds\n`

  try {
    await fs.writeFile('results.txt', results)
    console.log(`\nResults saved to results.txt`)
  } catch (err) {
    console.error('Failed to write results to results.txt:', err)
    logError(`Failed to write results to results.txt: ${err.message}`)
  }

  console.log(`\nTop ${topN} Largest Directories:`)
  sortedDirs.forEach(([dir, size], index) => {
    console.log(`${index + 1}. ${dir} - ${(size / (1024 ** 3)).toFixed(2)} GB`)
  })
  console.log(`\nExecution Time: ${((endTime - startTime) / 1000).toFixed(2)} seconds`)
}

const args = process.argv.slice(2)
if (args.length < 1) {
  console.error('Usage: node findLargestDirs.js <directory_path> [count]')
  process.exit(1)
}

const topDirectory = args[0]
const numberOfDirs = args[1] ? parseInt(args[1], 10) : 10

findLargestDirectories(topDirectory, numberOfDirs).catch((err) => {
  console.error(`An unexpected error occurred: ${err.message}`)
  logError(`Uncaught error: ${err.message}`)
})