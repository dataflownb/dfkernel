import { Manager as GraphManager, Graph } from '@dfnotebook/dfgraph';
import { DepView } from '../src/depview';
import { Minimap } from '../src/minimap';

describe('GraphManager', () => {
    beforeEach(() => {
      // Reset Manager state before each test
      GraphManager.graphs = {};
      GraphManager.depview = new DepView();
      GraphManager.minimap = new Minimap();
      GraphManager.previousActive = 'None';
    });
    
    it('minimap and depview should be Initialized properly', () => {
        GraphManager.depview = new DepView();
        expect(GraphManager.depview).toBeInstanceOf(DepView);
        GraphManager.minimap = new Minimap();
        expect(GraphManager.minimap).toBeInstanceOf(Minimap);
    });

    it('currentGraph, tracker and property initally Set to None', () => {
        expect(GraphManager.currentGraph).toEqual('None');
        expect(GraphManager.getProperty('someProp')).toEqual('');
        expect(GraphManager.tracker).toBeUndefined();
    });

    it('getProperty should return empty string if property does not exist', () => {
      expect(GraphManager.getProperty('nonExistentProp')).toEqual('');
    });
      
  });

describe('Graph', () => {
    let graph: Graph;

    beforeEach(() => {
      graph = new Graph();
    });

    describe('Initialization', () => {
        it('should create a graph with default values', () => {
            expect(graph.upstreamList).toEqual({});
            expect(graph.wasChanged).toBe(false);
            expect(graph.cells).toEqual([]);
            expect(graph.nodes).toEqual([]);
            expect(graph.uplinks).toEqual({});
            expect(graph.downlinks).toEqual({});
            expect(graph.internalNodes).toEqual({});
            expect(graph.downstreamLists).toEqual({});
            expect(graph.depview).toBeUndefined();
            expect(graph.minimap).toBeUndefined();
            expect(graph.cellContents).toEqual({});
            expect(graph.cellOrder).toEqual([]);
            expect(graph.states).toEqual({});
            expect(graph.executed).toEqual({});
        });

     });

    describe('Update', () => {
      it('should update stale states', () => {
        graph.updateStale('uuid');
        expect(graph.states['uuid']).toBe('Changed');
      });
    
      it('should update fresh states', () => {
        const uplinks = { 'uuid': ['node1', 'node2'] };
        graph.uplinks = uplinks;
        graph.updateFresh('uuid', false);
        expect(graph.states['uuid']).toBe('Fresh');
      });
    
      it('should update upstream fresh states', () => {
        const uplinks = { 'uuid': ['node1', 'node2'] };
        graph.uplinks = uplinks;
        graph.updateDepLists(['up1', 'up2'], 'uuid');
        graph.updateFresh('uuid', false);
        expect(graph.upstreamFresh('uuid')).toBe(true);
      });
    
      it('should update downstream lists', () => {
        graph.updateDownLinks([{ key: 'uuid', data: ['down1', 'down2'] }]);
        expect(graph.downlinks['uuid']).toEqual(['down1', 'down2']);
      });
    
      it('should update cell contents', () => {
        graph.updateCellContents({ uuid: ' contents' });
        expect(graph.cellContents['uuid']).toBe(' contents');
      });
    
      it('should return all upstreams', () => {
        graph.updateDepLists(['up1', 'up2'], 'uuid');
        expect(graph.getAllUpstreams('uuid')).toEqual(['up1', 'up2']);
      });
    
      it('should return downstreams', () => {
        graph.updateDownLinks([{ key: 'uuid', data: ['down1', 'down2'] }]);
        expect(graph.getDownstreams('uuid')).toEqual(['down1', 'down2']);
      });
    
      it('should return internal nodes', () => {
        graph.setInternalNodes('uuid', ['node1', 'node2']);
        expect(graph.getInternalNodes('uuid')).toEqual(['node1', 'node2']);
      });
    });
  });
  