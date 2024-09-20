// ignored_file_list.js

const IGNORED_FILES = new Set([
  'pagefile.sys',
  'hiberfil.sys',
  'swapfile.sys',
  'dumpstack.log.tmp',
  'memory.dmp',
])

const IGNORED_DIRS = new Set([
  'perflogs',
  'recovery',
  'system volume information',
  '$recycle.bin',
  'program files',
  'program files (x86)',
  // 'windows',
])

module.exports = { IGNORED_FILES, IGNORED_DIRS }
