import { LayerMetadata, SensorType } from '@map-colonies/mc-model-types';
import { LayersManager } from '../../../../src/layers/models/layersManager';
import { createLayerTasksMock, getLayerStatusMock, dbClientMock } from '../../../mocks/clients/storageClient';
import { addTilingRequestMock, tillerClientMock } from '../../../mocks/clients/tillerClient';
import { catalogExistsMock, catalogClientMock } from '../../../mocks/clients/catalogClient';
import { mapPublisherClientMock, mapExistsMock } from '../../../mocks/clients/mapPublisherClient';
import { getMock as configGetMock, configMock } from '../../../mocks/config';
import { logger } from '../../../mocks/logger';
import { fileValidatorValidateExistsMock, fileValidatorMock } from '../../../mocks/fileValidator';
import { TaskState } from '../../../../src/serviceClients/storageClient';
import { ConflictError } from '../../../../src/common/exceptions/http/conflictError';
import { BadRequestError } from '../../../../src/common/exceptions/http/badRequestError';

let layersManager: LayersManager;

const testImageMetadata: LayerMetadata = {
  source: 'test',
  version: '1.22',
  sourceName: 'test name',
  dsc: 'test desc',
  ep90: 3,
  resolution: 0.3,
  rms: 0.5,
  scale: '3',
  sensorType: SensorType.OTHER,
  updateDate: new Date('01/01/2020'),
  fileUris: [],
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    ],
  },
};
describe('LayersManager', () => {
  beforeEach(function () {
    jest.resetAllMocks();
  });

  describe('createLayer', () => {
    it('saves metadata before queueing tasks', async function () {
      configGetMock.mockImplementation((key: string) => {
        switch (key) {
          case 'tiling.zoomGroups':
            return '1,2-3';
        }
      });
      const tillingReqs = [
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '1',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 1,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 1,
        },
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '1',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 2,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 3,
        },
      ];
      let saved = false;
      let tiledBeforeSave = false;
      createLayerTasksMock.mockImplementation(async () => {
        saved = true;
        return Promise.resolve(tillingReqs);
      });
      addTilingRequestMock.mockImplementation(async () => {
        if (!saved) {
          tiledBeforeSave = true;
        }
        return Promise.resolve();
      });
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      getLayerStatusMock.mockResolvedValue(undefined);

      layersManager = new LayersManager(
        logger,
        configMock,
        tillerClientMock,
        dbClientMock,
        catalogClientMock,
        mapPublisherClientMock,
        fileValidatorMock
      );

      await layersManager.createLayer(testImageMetadata);

      expect(createLayerTasksMock).toHaveBeenCalledTimes(1);
      expect(createLayerTasksMock).toHaveBeenCalledWith(testImageMetadata, [
        { minZoom: 1, maxZoom: 1 },
        { minZoom: 2, maxZoom: 3 },
      ]);
      expect(addTilingRequestMock).toHaveBeenCalledTimes(2);
      expect(tiledBeforeSave).toBe(false);
    });

    it('split the tasks based on configuration', async function () {
      const tillingReqs = [
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '1',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 1,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 1,
        },
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '2',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 5,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 8,
        },
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '3',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 2,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 2,
        },
      ];
      createLayerTasksMock.mockResolvedValue(tillingReqs);
      configGetMock.mockImplementation((key: string) => {
        switch (key) {
          case 'tiling.zoomGroups':
            return '1,8-5,2';
        }
      });
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      getLayerStatusMock.mockResolvedValue(undefined);

      layersManager = new LayersManager(
        logger,
        configMock,
        tillerClientMock,
        dbClientMock,
        catalogClientMock,
        mapPublisherClientMock,
        fileValidatorMock
      );

      await layersManager.createLayer(testImageMetadata);

      expect(createLayerTasksMock).toHaveBeenCalledWith(testImageMetadata, [
        { minZoom: 1, maxZoom: 1 },
        { minZoom: 5, maxZoom: 8 },
        { minZoom: 2, maxZoom: 2 },
      ]);
      expect(addTilingRequestMock).toHaveBeenCalledTimes(3);
      expect(addTilingRequestMock).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        discrete_id: testImageMetadata.source,
        version: testImageMetadata.version,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        task_id: '1',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        min_zoom_level: 1,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        max_zoom_level: 1,
      });
      expect(addTilingRequestMock).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        discrete_id: testImageMetadata.source,
        version: testImageMetadata.version,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        task_id: '2',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        min_zoom_level: 5,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        max_zoom_level: 8,
      });
      expect(addTilingRequestMock).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        discrete_id: testImageMetadata.source,
        version: testImageMetadata.version,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        task_id: '3',
        // eslint-disable-next-line @typescript-eslint/naming-convention
        min_zoom_level: 2,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        max_zoom_level: 2,
      });
    });

    it('fail if layer status is pending', async function () {
      configGetMock.mockImplementation((key: string) => {
        switch (key) {
          case 'tiling.zoomGroups':
            return '1';
        }
      });
      const tillingReqs = [
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '1',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 1,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 1,
        },
      ];
      createLayerTasksMock.mockResolvedValue(tillingReqs);
      addTilingRequestMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      getLayerStatusMock.mockResolvedValue(TaskState.PENDING);

      layersManager = new LayersManager(
        logger,
        configMock,
        tillerClientMock,
        dbClientMock,
        catalogClientMock,
        mapPublisherClientMock,
        fileValidatorMock
      );

      const action = async () => {
        await layersManager.createLayer(testImageMetadata);
      };
      await expect(action).rejects.toThrow(ConflictError);
    });

    it('fail if layer status is inProgress', async function () {
      configGetMock.mockImplementation((key: string) => {
        switch (key) {
          case 'tiling.zoomGroups':
            return '1';
        }
      });
      const tillingReqs = [
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '1',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 1,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 1,
        },
      ];
      createLayerTasksMock.mockResolvedValue(tillingReqs);
      addTilingRequestMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      getLayerStatusMock.mockResolvedValue(TaskState.IN_PROGRESS);

      layersManager = new LayersManager(
        logger,
        configMock,
        tillerClientMock,
        dbClientMock,
        catalogClientMock,
        mapPublisherClientMock,
        fileValidatorMock
      );

      const action = async () => {
        await layersManager.createLayer(testImageMetadata);
      };
      await expect(action).rejects.toThrow(ConflictError);
    });

    it('pass if layer status is completed', async function () {
      configGetMock.mockImplementation((key: string) => {
        switch (key) {
          case 'tiling.zoomGroups':
            return '1';
        }
      });
      const tillingReqs = [
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '1',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 1,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 1,
        },
      ];
      createLayerTasksMock.mockResolvedValue(tillingReqs);
      addTilingRequestMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      getLayerStatusMock.mockResolvedValue(TaskState.COMPLETED);

      layersManager = new LayersManager(
        logger,
        configMock,
        tillerClientMock,
        dbClientMock,
        catalogClientMock,
        mapPublisherClientMock,
        fileValidatorMock
      );

      const action = async () => {
        await layersManager.createLayer(testImageMetadata);
      };
      await expect(action()).resolves.not.toThrow();
    });

    it('pass if layer status is failed', async function () {
      configGetMock.mockImplementation((key: string) => {
        switch (key) {
          case 'tiling.zoomGroups':
            return '1';
        }
      });
      const tillingReqs = [
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '1',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 1,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 1,
        },
      ];
      createLayerTasksMock.mockResolvedValue(tillingReqs);
      addTilingRequestMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      getLayerStatusMock.mockResolvedValue(TaskState.FAILED);

      layersManager = new LayersManager(
        logger,
        configMock,
        tillerClientMock,
        dbClientMock,
        catalogClientMock,
        mapPublisherClientMock,
        fileValidatorMock
      );

      const action = async () => {
        await layersManager.createLayer(testImageMetadata);
      };
      await expect(action()).resolves.not.toThrow();
    });

    it('fail if layer exists in mapping server', async function () {
      configGetMock.mockImplementation((key: string) => {
        switch (key) {
          case 'tiling.zoomGroups':
            return '1';
        }
      });
      const tillingReqs = [
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '1',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 1,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 1,
        },
      ];
      createLayerTasksMock.mockResolvedValue(tillingReqs);
      addTilingRequestMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(true);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      getLayerStatusMock.mockResolvedValue(undefined);

      layersManager = new LayersManager(
        logger,
        configMock,
        tillerClientMock,
        dbClientMock,
        catalogClientMock,
        mapPublisherClientMock,
        fileValidatorMock
      );

      const action = async () => {
        await layersManager.createLayer(testImageMetadata);
      };
      await expect(action).rejects.toThrow(ConflictError);
    });

    it('fail if layer exists in catalog', async function () {
      configGetMock.mockImplementation((key: string) => {
        switch (key) {
          case 'tiling.zoomGroups':
            return '1';
        }
      });
      const tillingReqs = [
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '1',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 1,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 1,
        },
      ];
      createLayerTasksMock.mockResolvedValue(tillingReqs);
      addTilingRequestMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(true);
      fileValidatorValidateExistsMock.mockResolvedValue(true);
      getLayerStatusMock.mockResolvedValue(undefined);

      layersManager = new LayersManager(
        logger,
        configMock,
        tillerClientMock,
        dbClientMock,
        catalogClientMock,
        mapPublisherClientMock,
        fileValidatorMock
      );

      const action = async () => {
        await layersManager.createLayer(testImageMetadata);
      };
      await expect(action).rejects.toThrow(ConflictError);
    });

    it('fail if files are missing', async function () {
      configGetMock.mockImplementation((key: string) => {
        switch (key) {
          case 'tiling.zoomGroups':
            return '1';
        }
      });
      const tillingReqs = [
        {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          discrete_id: testImageMetadata.source,
          version: testImageMetadata.version,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          task_id: '1',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          min_zoom_level: 1,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          max_zoom_level: 1,
        },
      ];
      createLayerTasksMock.mockResolvedValue(tillingReqs);
      addTilingRequestMock.mockResolvedValue(undefined);
      mapExistsMock.mockResolvedValue(false);
      catalogExistsMock.mockResolvedValue(false);
      fileValidatorValidateExistsMock.mockResolvedValue(false);
      getLayerStatusMock.mockResolvedValue(undefined);

      layersManager = new LayersManager(
        logger,
        configMock,
        tillerClientMock,
        dbClientMock,
        catalogClientMock,
        mapPublisherClientMock,
        fileValidatorMock
      );

      const action = async () => {
        await layersManager.createLayer(testImageMetadata);
      };
      await expect(action).rejects.toThrow(BadRequestError);
    });
  });
});
