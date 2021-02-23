import { ITaskId } from '../../../../src/tasks/interfaces';
import { TasksManager } from '../../../../src/tasks/models/tasksManager';
import { getCompletedZoomLevelsMock, dbClientMock } from '../../../mocks/clients/storageClient';
import { publishLayerMock, mapPublisherClientMock } from '../../../mocks/clients/mapPublisherClient';
import { getMock as configGetMock, configMock } from '../../../mocks/config';
import { logger } from '../../../mocks/logger';

let tasksManager: TasksManager;

//TODO: add catalog mock when catalog is added

const testData: ITaskId = {
  id: 'test',
  version: '1',
};
describe('TasksManager', () => {
  beforeEach(function () {
    jest.resetAllMocks();
  });

  describe('completeWorkerTask', () => {
    it('publish layer if all tasks are done', async function () {
      configGetMock.mockReturnValue('0-10,11,12,13,14,15,16,17,18');
      getCompletedZoomLevelsMock.mockReturnValue({
        completed: true,
        successful: true,
        metaData: {
          dsc: 'test desc',
          source: 'test',
          version: '1',
        },
      });
      tasksManager = new TasksManager(logger, configMock, dbClientMock, mapPublisherClientMock);

      await tasksManager.taskComplete(testData);

      expect(getCompletedZoomLevelsMock).toHaveBeenCalledTimes(1);
      //expect(publishToCatalogMock).toHaveBeenCalledTimes(1);
      expect(publishLayerMock).toHaveBeenCalledTimes(1);
      const expectedPublishReq = {
        description: 'test desc',
        maxZoomLevel: 18,
        name: 'test-1',
        tilesPath: 'test/1',
      };
      expect(publishLayerMock).toHaveBeenCalledWith(expectedPublishReq);
    });

    it('do nothing if some tasks are not done', async function () {
      configGetMock.mockReturnValue('');
      getCompletedZoomLevelsMock.mockReturnValue({
        allCompleted: false,
      });
      tasksManager = new TasksManager(logger, configMock, dbClientMock, mapPublisherClientMock);

      await tasksManager.taskComplete(testData);

      expect(getCompletedZoomLevelsMock).toHaveBeenCalledTimes(1);
      //expect(publishToCatalogMock).toHaveBeenCalledTimes(0);
      expect(publishLayerMock).toHaveBeenCalledTimes(0);
    });
  });
});
