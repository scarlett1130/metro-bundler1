/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @emails oncall+js_foundation
 */

'use strict';

jest.mock('fs', () => new (require('metro-memory-fs'))());

const AssetModule = require('../AssetModule');
const DependencyGraphHelpers = require('../DependencyGraph/DependencyGraphHelpers');
const ModuleCache = require('../ModuleCache');
const fs = require('fs');

describe('AssetModule:', () => {
  const defaults = {file: '/arbitrary.png'};

  beforeEach(() => {
    fs.reset();
    fs.mkdirSync('/root');
    fs.writeFileSync('/root/image.png', 'png data');
  });

  it('is an asset', () => {
    expect(new AssetModule(defaults).isAsset()).toBe(true);
  });

  it('returns an empty source code for an asset', async () => {
    const module = new AssetModule({
      depGraphHelpers: new DependencyGraphHelpers({
        providesModuleNodeModules: [],
        assetExts: ['png'],
      }),
      file: '/root/image.png',
      getTransformCacheKey: () => 'foo',
      localPath: 'image.png',
      moduleCache: new ModuleCache({}),
      transformCode: () => {
        return Promise.resolve({output: [{code: 'module.exports = "asset";'}]});
      },
    });

    const data = await module.read();

    expect(data.output[0].code).toBe('module.exports = "asset";');
  });
});
