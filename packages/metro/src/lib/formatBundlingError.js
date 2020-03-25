/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow
 */

'use strict';

const ErrorStackParser = require('error-stack-parser');
const GraphNotFoundError = require('../IncrementalBundler/GraphNotFoundError');
const ResourceNotFoundError = require('../IncrementalBundler/ResourceNotFoundError');
const RevisionNotFoundError = require('../IncrementalBundler/RevisionNotFoundError');

const fs = require('fs');
const serializeError = require('serialize-error');

const {
  UnableToResolveError,
} = require('../node-haste/DependencyGraph/ModuleResolution');
const {codeFrameColumns} = require('@babel/code-frame');
const {AmbiguousModuleResolutionError} = require('metro-core');

import type {FormattedError} from './bundle-modules/types.flow';

export type CustomError = Error & {
  type?: string,
  filename?: string,
  lineNumber?: number,
  errors?: Array<{
    description: string,
    filename: string,
    lineNumber: number,
    ...
  }>,
  ...
};

function formatBundlingError(error: CustomError): FormattedError {
  if (error instanceof AmbiguousModuleResolutionError) {
    const he = error.hasteError;
    const message =
      "Ambiguous resolution: module '" +
      `${error.fromModulePath}\' tries to require \'${he.hasteName}\', but ` +
      'there are several files providing this module. You can delete or ' +
      'fix them: \n\n' +
      Object.keys(he.duplicatesSet)
        .sort()
        .map(dupFilePath => `${dupFilePath}`)
        .join('\n\n');

    return {
      type: 'AmbiguousModuleResolutionError',
      message,
      errors: [{description: message}],
    };
  }

  if (
    error instanceof UnableToResolveError ||
    (error instanceof Error &&
      (error.type === 'TransformError' || error.type === 'NotFoundError'))
  ) {
    error.errors = [
      {
        description: error.message,
        filename: error.filename,
        lineNumber: error.lineNumber,
      },
    ];

    return serializeError(error);
  } else if (error instanceof ResourceNotFoundError) {
    return {
      type: 'ResourceNotFoundError',
      errors: [],
      message: error.message,
    };
  } else if (error instanceof GraphNotFoundError) {
    return {
      type: 'GraphNotFoundError',
      errors: [],
      message: error.message,
    };
  } else if (error instanceof RevisionNotFoundError) {
    return {
      type: 'RevisionNotFoundError',
      errors: [],
      message: error.message,
    };
  } else {
    const stack = ErrorStackParser.parse(error);
    const fileName = stack[0].fileName;
    const column = stack[0].columnNumber;
    const line = stack[0].lineNumber;

    const codeFrame = codeFrameColumns(
      fs.readFileSync(fileName, 'utf8'),
      {
        start: {column, line},
      },
      {forceColor: true},
    );

    return {
      type: 'InternalError',
      errors: [],
      message: `Metro has encountered an error: ${error.message}: ${fileName} (${line}:${column})\n\n${codeFrame}`,
    };
  }
}

module.exports = formatBundlingError;
