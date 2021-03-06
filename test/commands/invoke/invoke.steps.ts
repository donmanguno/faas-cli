/* eslint-disable import/first */
import { defineFeature, loadFeature } from 'jest-cucumber';
import * as fs from 'fs-extra';
import * as os from 'os';
import { join } from 'path';

beforeAll(() => {
  jest.resetAllMocks();
});

jest.mock('../../../src/service/faas.service', () =>
  jest.requireActual('../../__mocks__/faas.service.ts'),
);
jest.mock('../../../src/service/faasFactory.service', () =>
  jest.requireActual('../../__mocks__/faasFactory.service.ts'),
);

import { InvokeController } from '../../../src/controller/invoke.controller';
import { FileService } from '../../../src/service/file.service';


const feature = loadFeature('test/commands/invoke/invoke.feature');
defineFeature(feature, (test) => {
  jest.setTimeout(100000);
  const testDir = join(__dirname, 'test');
  let consoleSpy;
  const fileService = new FileService();

  beforeEach(() => {
    consoleSpy = jest.spyOn(global.console, 'log').mockImplementation();
    jest.spyOn(process, 'cwd').mockReturnValue(testDir);
    jest.spyOn(os, 'tmpdir').mockReturnValue(testDir);
    fs.ensureDirSync(testDir);
    fs.ensureDirSync(join(testDir, 'bin'));
    fs.ensureDirSync(join(testDir, 'functions'));
  });

  afterEach(() => {
    consoleSpy = undefined;
    jest.resetAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
    fs.removeSync(testDir);
  });

  test('Invoke a function remote', ({ given, when, then }) => {
    given('I have done the local init', () => {
      fs.ensureDirSync(join(testDir, 'functions', 'InvokeFunctionRemote'));
    });

    given("I'm logged in", async () => {
      await fileService.writeTempFile({
        '123456789': {
          token: '978654312564',
          userId: 'userId_invoke_remote_success',
          username: 'invoke@liveperson.com',
          active: true,
        },
      });
    });

    given(
      'The function is created on the platform and I have the same local with a config.json',
      () => {
        fs.writeFileSync(
          join(testDir, 'functions', 'InvokeFunctionRemote', 'config.json'),
          JSON.stringify({
            name: 'InvokeFunctionRemote',
            event: null,
            input: {
              headers: [],
              payload: {},
            },
            environmentVariables: [
              {
                key: '',
                value: '',
              },
            ],
          }),
        );
        fs.writeFileSync(
          join(testDir, 'functions', 'InvokeFunctionRemote', 'index.js'),
          JSON.stringify({}),
        );
      },
    );

    when('I run the invoke command and pass the function name', async () => {
      const invokeController = new InvokeController();
      await invokeController.invoke({
        lambdaFunctions: ['InvokeFunctionRemote'],
      });
    });

    then(
      'It should invoke the function and print the logs to the console',
      () => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringMatching(/StatusCode: 200/),
        );
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Info/));
      },
    );
  });
  test('Invoke a function remote with no function created on the platform', ({
    given,
    when,
    then,
  }) => {
    given('I have done the local init', () => {
      fs.ensureDirSync(
        join(testDir, 'functions', 'InvokeFunctionRemoteNotFound'),
      );
    });

    given('The function is not created on the platform', () => {
      fs.writeFileSync(
        join(
          testDir,
          'functions',
          'InvokeFunctionRemoteNotFound',
          'config.json',
        ),
        JSON.stringify({
          name: 'InvokeFunctionRemoteNotFound',
          event: null,
          input: {
            headers: [],
            payload: {},
          },
          environmentVariables: [
            {
              key: '',
              value: '',
            },
          ],
        }),
      );
    });

    when('I run the invoke command and pass the function name', async () => {
      const invokeController = new InvokeController();
      await invokeController.invoke({
        lambdaFunctions: ['InvokeFunctionRemoteNotFound'],
      });
    });

    then(
      'It should print in error message which tells me that the function is not created on the platform',
      () => {
        expect(consoleSpy).toBeCalledWith(
          expect.stringMatching(
            /Function InvokeFunctionRemoteNotFound were not found on the platform/,
          ),
        );
      },
    );
  });

  test('Invoke a function local', async ({ given, when, then }) => {
    given('I have done the local init', () => {
      fs.ensureDirSync(join(testDir, 'functions', 'InvokeFunctionLocal'));
    });

    given('I have a local function with the config.json', () => {
      fs.writeFileSync(
        join(testDir, 'functions', 'InvokeFunctionLocal', 'config.json'),
        JSON.stringify({
          name: 'InvokeFunctionLocal',
          event: null,
          input: {
            headers: [],
            payload: {},
          },
          environmentVariables: [
            {
              key: 'TestKey',
              value: 'TestValue',
            },
          ],
        }),
      );
      fs.writeFileSync(
        join(testDir, 'functions', 'InvokeFunctionLocal', 'index.js'),
        `function lambda(input, callback) {
  callback(null, 'Hello World');
}
`,
      );
      fs.copySync(
        join(
          process.cwd(),
          '..',
          '..',
          '..',
          '..',
          'bin',
          'example',
          'bin',
          'rewire.js',
        ),
        join(testDir, 'bin', 'rewire.js'),
      );
    });

    when(
      'I run the invoke command and pass the function name and local flag',
      async () => {
        process.env.DEBUG_PATH = 'true';
        const invokeController = new InvokeController();
        await invokeController.invoke({
          lambdaFunctions: ['InvokeFunctionLocal'],
          inputFlags: { local: true },
        });
      },
    );

    then('It should set the passed env variables', () => {
      const containsTestKey = Object.keys(process.env).some(
        (e) => e === 'TestKey',
      );
      expect(containsTestKey).toBeTruthy();
    });

    then(
      'It invokes the command local and print the logs to the console',
      () => {
        expect(consoleSpy).toBeCalledWith(
          expect.stringContaining('Hello World'),
        );
      },
    );
  });

  test('Invoke a function local with an console.error in it', ({
    given,
    when,
    then,
  }) => {
    given('I have done the local init', () => {
      fs.ensureDirSync(
        join(testDir, 'functions', 'InvokeFunctionLocalWithError'),
      );
    });

    given(
      'I have a local function with the config.json (console.error implemented)',
      () => {
        fs.writeFileSync(
          join(
            testDir,
            'functions',
            'InvokeFunctionLocalWithError',
            'config.json',
          ),
          JSON.stringify({
            name: 'InvokeFunctionLocal30Seconds',
            event: null,
            input: {
              headers: [],
              payload: {},
            },
            environmentVariables: [
              {
                key: '',
                value: '',
              },
            ],
          }),
        );
        fs.writeFileSync(
          join(
            testDir,
            'functions',
            'InvokeFunctionLocalWithError',
            'index.js',
          ),
          `function lambda(input, callback) {
    console.error(new Error('INVALID LAMBDA'));
    callback(null, 'Hello World');
}
`,
        );
      },
    );

    when(
      'I run the invoke command and pass the function name and local flag',
      async () => {
        process.env.DEBUG_PATH = 'true';
        const invokeController = new InvokeController();
        await invokeController.invoke({
          lambdaFunctions: ['InvokeFunctionLocalWithError'],
          inputFlags: { local: true },
        });
      },
    );

    then(
      'It invokes the command local and print the logs with error to the console',
      () => {
        expect(consoleSpy).toBeCalledWith(
          expect.stringContaining('com.liveperson.faas.handler.custom-failure'),
        );
        expect(consoleSpy).toBeCalledWith(
          expect.stringContaining('INVALID LAMBDA'),
        );
      },
    );
  });

  test('Invoke a function local with a runtime longer than 30 seconds', ({
    given,
    when,
    then,
  }) => {
    given('I have done the local init', () => {
      fs.ensureDirSync(
        join(testDir, 'functions', 'InvokeFunctionLocal30Seconds'),
      );
    });

    given(
      'I have a local function with the config.json (runtime is longer than 30 seconds)',
      () => {
        fs.writeFileSync(
          join(
            testDir,
            'functions',
            'InvokeFunctionLocal30Seconds',
            'config.json',
          ),
          JSON.stringify({
            name: 'InvokeFunctionLocal30Seconds',
            event: null,
            input: {
              headers: [],
              payload: {},
            },
            environmentVariables: [
              {
                key: '',
                value: '',
              },
            ],
          }),
        );
        fs.writeFileSync(
          join(
            testDir,
            'functions',
            'InvokeFunctionLocal30Seconds',
            'index.js',
          ),
          `function lambda(input, callback) {
  setTimeout(() => {
    callback(null, 'Hello World');
  }, 31000)
}
`,
        );
      },
    );

    when(
      'I run the invoke command and pass the function name and local flag',
      async () => {
        process.env.DEBUG_PATH = 'true';
        const invokeController = new InvokeController();
        await invokeController.invoke({
          lambdaFunctions: ['InvokeFunctionLocal30Seconds'],
          inputFlags: { local: true },
        });
      },
    );

    then(
      'It invokes the command local and print an error that the functions runs longer than 30 seconds',
      () => {
        expect(consoleSpy).toBeCalledWith(
          expect.stringContaining(
            'Lambda did not call callback within execution time limit',
          ),
        );
      },
    );
  });
});
