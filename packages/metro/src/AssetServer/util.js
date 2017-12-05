/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

'use strict';

const AssetPaths = require('../node-haste/lib/AssetPaths');

const denodeify = require('denodeify');
const fs = require('fs');
const path = require('path');

const stat = denodeify(fs.stat);
const readDir = denodeify(fs.readdir);

import type {AssetPath} from '../node-haste/lib/AssetPaths';

function buildAssetMap(
  dir: string,
  files: $ReadOnlyArray<string>,
  platform: ?string,
): Map<
  string,
  {|
    files: Array<string>,
    scales: Array<number>,
  |},
> {
  const platforms = new Set(platform != null ? [platform] : []);
  const assets = files.map(getAssetDataFromName.bind(this, platforms));
  const map = new Map();
  assets.forEach(function(asset, i) {
    if (asset == null) {
      return;
    }
    const file = files[i];
    const assetKey = getAssetKey(asset.assetName, asset.platform);
    let record = map.get(assetKey);
    if (!record) {
      record = {
        scales: [],
        files: [],
      };
      map.set(assetKey, record);
    }

    let insertIndex;
    const length = record.scales.length;

    for (insertIndex = 0; insertIndex < length; insertIndex++) {
      if (asset.resolution < record.scales[insertIndex]) {
        break;
      }
    }
    record.scales.splice(insertIndex, 0, asset.resolution);
    record.files.splice(insertIndex, 0, path.join(dir, file));
  });

  return map;
}

function getAssetDataFromName(
  platforms: Set<string>,
  file: string,
): ?AssetPath {
  return AssetPaths.tryParse(file, platforms);
}

function getAssetKey(assetName, platform) {
  if (platform != null) {
    return `${assetName} : ${platform}`;
  } else {
    return assetName;
  }
}

function hashFiles(files, hash, callback) {
  if (!files.length) {
    callback(null);
    return;
  }

  fs
    .createReadStream(files.shift())
    .on('data', data => hash.update(data))
    .once('end', () => hashFiles(files, hash, callback))
    .once('error', error => callback(error));
}

async function getAbsoluteAssetRecord(
  assetPath: string,
  platform: ?string = null,
): Promise<{|
  files: Array<string>,
  scales: Array<number>,
|}> {
  const filename = path.basename(assetPath);
  const dir = path.dirname(assetPath);
  const files = await readDir(dir);

  const assetData = AssetPaths.parse(
    filename,
    new Set(platform != null ? [platform] : []),
  );

  const map = buildAssetMap(dir, files, platform);

  let record;
  if (platform != null) {
    record =
      map.get(getAssetKey(assetData.assetName, platform)) ||
      map.get(assetData.assetName);
  } else {
    record = map.get(assetData.assetName);
  }

  if (!record) {
    throw new Error(
      /* $FlowFixMe: platform can be null */
      `Asset not found: ${assetPath} for platform: ${platform}`,
    );
  }

  return record;
}

async function findRoot(
  roots: $ReadOnlyArray<string>,
  dir: string,
  debugInfoFile: string,
): Promise<string> {
  const stats = await Promise.all(
    roots.map(async root => {
      // important: we want to resolve root + dir
      // to ensure the requested path doesn't traverse beyond root
      const absPath = path.resolve(root, dir);

      try {
        const fstat = await stat(absPath);

        // keep asset requests from traversing files
        // up from the root (e.g. ../../../etc/hosts)
        if (!absPath.startsWith(path.resolve(root))) {
          return {path: absPath, isValid: false};
        }
        return {path: absPath, isValid: fstat.isDirectory()};
      } catch (_) {
        return {path: absPath, isValid: false};
      }
    }),
  );

  for (let i = 0; i < stats.length; i++) {
    if (stats[i].isValid) {
      return stats[i].path;
    }
  }

  const rootsString = roots.map(s => `'${s}'`).join(', ');
  throw new Error(
    `'${debugInfoFile}' could not be found, because '${dir}' is not a ` +
      `subdirectory of any of the roots  (${rootsString})`,
  );
}

module.exports = {
  findRoot,
  getAbsoluteAssetRecord,
  hashFiles: denodeify(hashFiles),
};
