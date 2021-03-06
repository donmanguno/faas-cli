import { exec as execDefault } from 'child_process';
import { PackageManager } from '../controller/init.controller';
import { DefaultStructureService } from '../service/defaultStructure.service';
import { ErrorMessage, TaskList } from './printer';

interface IInitViewConstructor {
  error?: ErrorMessage;
  tasklist?: TaskList;
  exec?: any;
  defaultStructureService?: DefaultStructureService;
}

interface ITaskListConfig {
  packageManager: PackageManager;
  needDependencyInstallation: boolean;
  functionNames?: string[];
}

export class InitView {
  private error: ErrorMessage;

  private tasklist: TaskList;

  private exec: any;

  private defaultStructureService: DefaultStructureService;

  constructor({
    error = new ErrorMessage(),
    tasklist = new TaskList({ concurrent: true, exitOnError: false }),
    exec = execDefault,
    defaultStructureService = new DefaultStructureService(),
  }: IInitViewConstructor = {}) {
    this.error = error;
    this.tasklist = tasklist;
    this.exec = exec;
    this.defaultStructureService = defaultStructureService;
  }

  /**
   * Prints an error message
   * @param {string} message - message
   * @returns {void}
   * @memberof InitView
   */
  public errorMessage(message: string): void {
    return this.error.print(message);
  }

  /**
   * Runs the tasklist which initialise all folder and files
   * @param { packageManager, needDependencyInstallation, functionNames } - Passes the used package manager, if an installation is required and functions to initialize.
   * @returns {Promise<void>}
   * @memberof InitView
   */
  public async showInitialiseTaskList({
    packageManager,
    needDependencyInstallation,
    functionNames,
  }: ITaskListConfig): Promise<void> {
    if (functionNames?.length) {
      functionNames.forEach((entry) => {
        this.tasklist.addTask({
          title: `Initialise ${entry}`,
          task: async () => {
            this.defaultStructureService.create(entry);
          },
        });
      });
    } else {
      this.tasklist.addTask({
        title: 'Initialise example function',
        task: async () => {
          this.defaultStructureService.create();
        },
      });
    }

    /* istanbul ignore else */
    if (needDependencyInstallation) {
      this.tasklist.addTask({
        title: 'Install packages',
        task: async (ctx) => {
          /* istanbul ignore next */
          if (ctx.packageManager === 'npm') {
            this.exec('cd bin/lp-faas-toolbelt && npm i');
          } else {
            this.exec('cd bin/lp-faas-toolbelt && yarn -i');
          }
        },
      });
    }

    await this.tasklist.run({ context: { packageManager } });
  }
}
