import * as d3 from 'd3';
import $ from 'jquery';
import '@hpcc-js/wasm';
import Writer from 'graphlib-dot';
import { graphviz, GraphvizOptions } from 'd3-graphviz';
import * as GraphLib from 'graphlib';

//UUID length has been changed need to compensate for that
const uuidLength = 8;

const defaultOptions: GraphvizOptions = {
  height: 1600,
  width: 1600,
  scale: 1,
  tweenPrecision: 1,
  engine: 'dot',
  keyMode: 'title',
  convertEqualSidedPolygons: false,
  fade: false,
  growEnteringEdges: false,
  fit: true,
  tweenPaths: false,
  tweenShapes: false,
  useWorker: false,
  zoom: true
};

export class DepView {
  isCreated: boolean;
  isOpen: boolean;
  dataflow: boolean;
  selected: boolean;
  doneRendering: boolean;
  debugMode: boolean;
  parentdiv: any;
  sidePanel: any;
  nodespanel: any;
  tabular: any;
  executePanel: any;
  labelstyles: string;
  cellLabel: string;
  cellLinks: any[];
  cellList: any[];
  cellChildNums: any[];
  outputNodes: any[];
  activeCell: string;
  dfgraph: any;
  dotgraph: any[];
  depdiv: any;
  svg: any;
  widget: any;
  tracker: any;
  order: any;
  graphtran: any;

  constructor(dfgraph?: any, parentdiv?: any, labelstyles?: string) {
    //Flags
    this.isOpen = false;
    this.dataflow = true;
    this.selected = false;
    this.doneRendering = false;
    this.isCreated = false;

    //Turn on console logs
    this.debugMode = false;

    //Divs and Div related variables
    this.parentdiv = parentdiv || 'div#depview';
    this.depdiv = null;
    this.sidePanel = null;
    this.nodespanel = null;
    this.svg = null;
    this.tabular = null;
    this.executePanel = null;
    //Label Styles should be set in text so that GraphViz can properly size the nodes
    this.labelstyles =
      labelstyles ||
      'font-family: monospace; fill: #D84315; font-size: 0.85em;';

    //Divs are created and defined in here
    //this.createDepDiv();

    //This has been largely factored out but this provides the option to change the label of a cell
    this.cellLabel = '';

    this.cellLinks = [];
    this.cellList = [];
    this.cellChildNums = [];
    this.outputNodes = [];
    this.activeCell = '';

    this.dfgraph = dfgraph;
    this.graphtran = null;
    //console.log(NotebookTools);

    this.dotgraph = [];

    //this.bind_events();
  }
  //
  //         /** @method bind_events */
  //FIXME: Figure out Jupyter.notebook equivalent here
  //     bind_events = function () {
  //         var that = this;
  //         var nb = Jupyter.notebook;
  //
  //         nb.events.on('create.Cell', function(evt,cell) {
  //             if(that.is_open){
  //                 that.update_cell_lists();
  //             }
  //         });
  //         nb.events.on('select.Cell', function(){
  //             var cell = Jupyter.notebook.get_selected_cell();
  //            if(cell.cell_type === 'code' && that.is_open){
  //                that.set_details(cell.uuid);
  //            }
  //         });
  //         nb.events.on('delete.Cell',function (evt,cell) {
  //             if(that.is_open){
  //                 that.decorate_cell(cell.cell.uuid,'deleted-cell',true);
  //             }
  //         });
  //     };
  //
  /** @method closes the depviewer **/
  closeDiv = function () {
    this.isOpen = false;
    this.depdiv.style.display = 'none';
    d3.select(this.parentdiv).transition().delay(100).style('height', '0vh');
    d3.select('.end_space').transition().delay(100).style('height', '0vh');
  };

  updateOrder = function (order: any) {
    this.order = order;
  };

  //
  //     /** @method closes the depviewer and scrolls to the currently selected cell **/
  //     close_and_scroll = function () {
  //       var that = this;
  //       if(that.active_cell && that.active_cell !== ''){
  //           that.close_div();
  //           Jupyter.notebook.select_by_id(that.active_cell);
  //           Jupyter.notebook.scroll_to_cell_id(that.active_cell);
  //           return;
  //       }
  //       that.close_div();
  //     };
  //
  //
  setTracker = function (tracker: any) {
    this.tracker = tracker;
    console.log(tracker);
  };

  /** @method creates dependency div*/
  createDepDiv = function () {
    let that = this;

    this.depdiv = document.createElement('div');
    this.depdiv.setAttribute('class', 'dep-div container');
    $(this.parentdiv).append(this.depdiv);

    this.sidePanel = d3
      .select('div.dep-div')
      .append('div')
      .attr('id', 'side-panel');

    this.tabular = this.sidePanel
      .append('div')
      .attr('id', 'table')
      .classed('card', true);
    //        this.tabular.append('h3').text("Graph Overview").classed('card-header', true).classed('primary-color', true).classed('white-text', true).classed('cell-list-header', true).attr('id', 'overview-header');

    //         let newdiv = this.tabular.append('div').classed('table-div',true);
    //         newdiv.append('h4').text('New Cells').classed('card-header', true).classed('primary-color', true).classed('white-text', true).classed('cell-list-header', true);
    //         newdiv.append('div').classed('card-body', true).attr('id', 'newlist').append('ul').classed('list-group', true).classed('list-group-flush', true);
    //
    //         let changediv = this.tabular.append('div').classed('table-div',true);
    //         changediv.append('h4').text('Changed Cells').classed('card-header', true).classed('primary-color', true).classed('white-text', true).classed('cell-list-header', true);
    //         changediv.append('div').classed('card-body', true).attr('id', 'changedlist').append('ul').classed('list-group', true).classed('list-group-flush', true);

    this.tabular
      .append('a')
      .text('⤓ Dot')
      .attr('id', 'dot-dl')
      .classed('btnviz', true)
      .classed('btnviz-primary', true)
      .classed('fa', true); //.classed('btnviz', true).classed('btnviz-outline-primary', true).classed('btnviz-rounded waves-effect', true);

    this.tabular
      .append('a')
      .text('Toggle Sink Cells')
      .attr('id', 'out-toggle')
      .classed('btnviz', true)
      .classed('btnviz-primary', true)
      .classed('fa', true) //.classed('btnviz', true).classed('btnviz-outline-primary', true).classed('btnviz-rounded waves-effect', true)
      .on('click', function () {
        that.dataflow = !that.dataflow;
        that.startGraphCreation();
      });

    //FIXME: This is where the Graph Summary button goes
    //this.tabular.append('a').text('Show Graph Summary').attr('id', 'graphsum').classed('btnviz', true).classed('btnviz-outline-primary', true).classed('btnviz-rounded waves-effect', true);

    //        this.executepanel = this.side_panel.append('div').attr('id', 'cell-detail').classed('card', true).style('background-color', 'white');
    //        this.executepanel.append('h3').text("Cell Overview").classed('card-header', true).classed('primary-color', true).classed('white-text', true).classed('cell-list-header', true).attr('id', 'overview-header');

    this.tabular
      .append('span')
      .text('Cell Local Variables:')
      .classed('locals', true); //.classed('card-title', true);
    this.tabular
      .data(['None'])
      .append('span')
      .text('None')
      .classed('badge-pill', true)
      .classed('badge-danger', true);
    //         this.nodespanel = this.executepanel.append('div').attr('id', 'nodes-panel');
    //         this.nodespanel.append('h4').text("Cell Local Variables:").classed('card-title', true);
    //         this.nodespanel.data(["None"]).append('span').text('None').classed('badge-pill', true).classed('badge-danger', true);

    //let executeactions = this.executepanel.append('div').attr('id','exec-actions');
    //FIME:FIX THIS
    // executeactions.append('a').text("  Execute Cell").classed('btnviz', true).classed('btnviz-primary', true).attr('id', 'exec-button').classed('fa-step-forward', true).classed('fa', true).on('click',function(){
    //     var cell = Jupyter.notebook.get_selected_cell();
    //     cell.execute();
    // });
    //executeactions.append('a').text("Close and Go to Cell").attr('id', 'close-scroll').classed('btnviz', true).classed('btnviz-primary', true).classed('fa', true).on('click', function () {that.close_and_scroll();});

    this.svg = d3
      .select('div.dep-div')
      .append('div')
      .attr('id', 'svg-div')
      .on('contextmenu', function () {
        return false;
      });
    this.isCreated = true;
  };

  /** @method upon a new cell selection will change the details of the viewer **/
  setDetails = function (cellid: string) {
    let that = this;
    $('#' + that.activeCell + 'cluster')
      .find('polygon')
      .toggleClass('selected', false);
    that.activeCell = cellid;
    d3.select('#select-identifier').remove();
    if (that.dfgraph.getCells().indexOf(that.activeCell) > -1) {
      // @ts-ignore
      let rectPoints = $('#' + that.activeCell + 'cluster')
        .find('polygon')
        .attr('points')
        .split(' ');
      let rectTop = rectPoints[1].split(',') as any;
      let height = Math.abs(rectTop[1] - Number(rectPoints[0].split(',')[1]));
      d3.select('#svg-div svg g')
        .insert('g', '#a_graph0 + *')
        .attr('id', 'select-identifier')
        .append('rect')
        .attr('x', parseInt(rectTop[0]) - 3)
        .attr('y', parseInt(rectTop[1]))
        .attr('height', height)
        .attr('width', '3px');
    }
    //FIXME: Find equivalent in Lab
    //console.log(NotebookTools);
    //const cell = panel.content.widgets[index];
    //cell.node.scrollIntoView();

    //Jupyter.notebook.select_by_id(that.active_cell);
    //Jupyter.notebook.scroll_to_cell_id(that.active_cell);
    this.tracker.currentWidget.content.activeCellIndex =
      this.order.indexOf(cellid);

    $('#' + cellid + 'cluster')
      .find('polygon')
      .toggleClass('selected', true);
    d3.select('#table').selectAll('.badge-pill').remove();
    let intNodes = that.dfgraph.getInternalNodes(cellid);
    if (intNodes.length < 1) {
      intNodes = ['None'];
    }
    d3.select('#table')
      .selectAll('span.badge')
      .data(intNodes)
      .enter()
      .append('span')
      .text(function (d: any) {
        return d;
      })
      .attr('class', function (d: any) {
        let baseclasses = 'badge badge-pill ';
        if (d === 'None') {
          return baseclasses + 'badge-danger';
        }
        return baseclasses + 'badge-primary';
      });
  };

  /** @method updates the new and changed cell lists **/
  updateCellLists = function () {
    let that = this;
    //let new_cells: string[] = [];
    //let changed_cells: string[] = [];

    //Goes with code below
    //var cells = that.dfgraph.get_cells();

    //FIXME: Find Jupyter Equivalent
    // Jupyter.notebook.get_cells().map(function(cell){
    //     if(cell.cell_type === 'code'){
    //         if(cells.indexOf(cell.uuid) > -1){
    //             if(cell.metadata.cell_status.substr(0,'edited'.length) === 'edited'){
    //                 changed_cells.push(cell.uuid);
    //             }
    //         }
    //         else{
    //             new_cells.push(cell.uuid);
    //         }
    //     }
    // });

    // TODO: REMOVE THIS FUNCTIONALITY, REVISIT AT SOME POINT?
    //             let new_list = d3.select('#newlist').select('ul').selectAll('li').data(new_cells);
    //
    //             new_list.attr('id',function(d){return 'viz-'+d;}).classed('cellid',true)
    //             .html(function(d){return 'In['+d+']';}).enter()
    //             .append('li').classed('list-group-item',true).append('a').classed('cellid',true).attr('id',function(d){return 'viz-'+d;})
    //             .html(function(d){return 'In['+d+']';});
    //
    //             new_list.exit().attr('opacity',1).transition().delay(500).attr('opacity',0).remove();
    //
    //             let changed_list = d3.select('#changedlist').select('ul').selectAll('li').data(changed_cells);
    //
    //             changed_list.attr('id',function(d){return 'viz-'+d;}).classed('cellid',true)
    //             .html(function(d){return 'In['+d+']';}).enter()
    //             .append('li').classed('list-group-item',true).append('a').classed('cellid',true).attr('id',function(d){return 'viz-'+d;})
    //             .html(function(d){return 'In['+d+']';});
    //
    //             changed_list.exit().attr('opacity',1).transition().delay(500).attr('opacity',0).remove();

    d3.select('#table')
      .selectAll('.cellid')
      .on('click', function (d) {
        that.setDetails(d);
      });

    //that.decorate_cells(changed_cells,'changed-cell',true);
  };

  decorateCells = function (cells: any[], cssClass: string, allCells: any[]) {
    cells = cells || [];
    allCells = allCells || false;

    if (allCells) {
      $('.cluster').find('polygon').toggleClass(cssClass, false);
    }

    cells.forEach(function (uuid) {
      $('#' + uuid + 'cluster')
        .find('polygon')
        .toggleClass(cssClass, true);
    });
  };

  decorateCell = function (uuid: string, cssClass: string, toggle: boolean) {
    if (this.isOpen) {
      uuid = uuid || '';
      $('#' + uuid + 'cluster')
        .find('polygon')
        .toggleClass(cssClass, toggle);
    }
  };

  /** @method this creates and renders the actual visual graph **/
  createGraph = function (g: any) {
    let that = this;
    g.nodes().forEach(function (v: any) {
      let node = g.node(v);
      // Round the corners of the nodes
      node.rx = node.ry = 5;
    });

    that.dotgraph = Writer.write(g);

    //FIXME: Something weird is going on here with the transitions if you declare them at the start they fail
    //but if you declare them here there is a large delay before the transition happens
    that.graphtran = d3.transition().duration(750).ease(d3.easeLinear);

    //FIXME: Not ideal way to be set this up, graphviz requires a set number of pixels for width and height
    graphviz('#svg-div')
      .options(defaultOptions)
      .on('end', function () {
        that.updateCellLists();
        that.doneRendering = true;
      })
      .transition(that.graphtran)
      .renderDot(that.dotgraph);

    let dotURL = URL.createObjectURL(
      new Blob([that.dotgraph], { type: 'text/plain;charset=utf-8' })
    );
    $('#dot-dl').attr('href', dotURL).attr('download', 'graph.dot');

    $('g.parentnode.cluster').each(function () {
      $(this)
        .mouseover(function () {
          let node = $(this),
            cellid = node
              .find('text')
              .text()
              .substr(that.cellLabel.length, uuidLength);

          that.setDetails(cellid);

          //var cell = Jupyter.notebook.get_code_cell(cellid);
          that.dfgraph.getDownstreams(cellid).forEach(function (t: string) {
            $('#' + t.substr(0, uuidLength) + 'cluster')
              .find('polygon')
              .toggleClass('upcell', true);
            $('g.' + cellid + t.substr(0, uuidLength))
              .find('path')
              .toggleClass('upstream', true);
          });
          that.dfgraph.getImmUpstreams(cellid).forEach(function (t: string) {
            $('#' + t.substr(0, uuidLength) + 'cluster')
              .find('polygon')
              .toggleClass('downcell', true);
            $('g.' + t.substr(0, uuidLength) + cellid)
              .find('path')
              .toggleClass('downstream', true);
          });
        })
        .on('mouseout', function () {
          //var node = $(this);
          //cellid = node.find('text').text().substr(that.cell_label.length,uuid_length);
          //var cell = Jupyter.notebook.get_code_cell(cellid);
          $('.edge').each(function () {
            $(this)
              .find('path')
              .toggleClass('upstream', false)
              .toggleClass('downstream', false);
          });
          $('g.parentnode, .cluster')
            .each(function () {
              $(this)
                .find('polygon')
                .toggleClass('upcell', false)
                .toggleClass('downcell', false);
            })
            .contextmenu(function () {
              return false;
            });
        });
    });

    $('g.child-node').each(function () {
      $(this)
        .mouseover(function () {
          $('.viz-' + $(this).find('title').text()).each(function () {
            $(this).find('path').toggleClass('upstream', true);
            $(this).find('polygon').toggleClass('upcell', true);
          });
        })
        .mouseout(function () {
          $('.viz-' + $(this).find('title').text()).each(function () {
            $(this).find('path').toggleClass('upstream', false);
          });
          $(this).find('polygon').toggleClass('upcell', false);
        });
    });

    //FIXME: Fix the Jupyter notebook reference here
    //var deleted_cells = Object.keys(Jupyter.notebook.metadata.hl_list || []);
    //that.decorate_cells(deleted_cells,'deleted-cell',true);

    $('g.parentnode.cluster').on('mousedown', function (event) {
      if (event.which == 1) {
        that.closeAndScroll();
      }
    });
    //FIXME: Fix this
    // .on("contextmenu",function(event){
    //     var cellid = $(this).find('text').text().substr(that.cell_label.length, uuid_length);
    //     Jupyter.notebook.get_code_cell(cellid).execute();
    // });
  };

  /** @method this ellides the names of output nodes **/
  getNodes = function (uuid: string) {
    return this.dfgraph.getNodes(uuid).map(function (a: string) {
      return a.length > 10 ? a.substring(0, 7) + '..' : a;
    });
  };

  /** @method this creates the graphlib data structure that is used to create the visualization **/
  createNodeRelations = function () {
    let that = this;
    that.cellLinks = [];
    that.cellList = [];
    that.cellChildNums = [];
    that.outputNodes = [];
    let outnames: string[] = [];

    if (that.dataflow) {
      that.cellList = that.dfgraph.getCells();
      that.cellList.forEach(function (uuid: string) {
        that.outputNodes[uuid] = that.getNodes(uuid);
        outnames = that.outputNodes[uuid];
        that.dfgraph.getUpstreams(uuid).forEach(function (b: string) {
          b = b.length > 10 ? b.substring(0, 7) + '..' : b;
          if (outnames.indexOf(uuid) > -1) {
            that.cellLinks.push({ source: b, target: uuid });
          } else {
            that.cellLinks.push({ source: b, target: uuid + '-Cell' });
          }
        });
      });
      //FIXME: Change this
      that.cellList = that.cellList.map(function (uuid: string) {
        return { id: uuid };
      });
    } else {
      that.cellList = that.dfgraph.getCells();
      that.cellList.forEach(function (uuid: string) {
        that.outputNodes[uuid] = that.getNodes(uuid);
        if (that.outputNodes[uuid].length == 0) {
          delete that.outputNodes[uuid];
          return;
        }

        outnames = that.outputNodes[uuid];

        if (uuid in that.outputNodes) {
          that.dfgraph.getUpstreams(uuid).forEach(function (b: string) {
            b = b.length > 10 ? b.substring(0, 7) + '..' : b;
            if (outnames.indexOf(uuid) > -1) {
              that.cellLinks.push({ source: b, target: uuid });
            } else {
              outnames.forEach(function (t: string) {
                that.cellLinks.push({ source: b, target: uuid + t });
              });
            }
          });
        }
      });
      //FIXME: Change this
      that.cellList = Object.keys(that.outputNodes).map(function (t: string) {
        return { id: t };
      });
    }

    that.cellList.forEach(function (a: any) {
      that.cellChildNums[a.id] = 0;
    });
    that.cellLinks.forEach(function (a: any) {
      that.cellChildNums[a.source] += 1;
    });
    let g = new GraphLib.Graph({ compound: true })
      .setGraph({
        compound: true,
        ranksep: 1,
        nodesep: 0.03,
        tooltip: ' ',
        rankdir: 'LR'
      })
      .setDefaultEdgeLabel(function () {
        return {};
      });

    that.cellList.forEach(function (a: any) {
      if (that.outputNodes[a.id]) {
        if (that.selected && a.level == 0) {
          g.setNode('cluster_Out[' + a.id + ']', {
            label: that.cellLabel + a.id,
            id: 'selected',
            clusterLabelPos: 'top',
            class: 'parentnode cellid',
            shape: 'box',
            margin: 5
          });
        } else {
          g.setNode('cluster_Out[' + a.id + ']', {
            label: that.cellLabel + a.id,
            id: a.id + 'cluster',
            clusterLabelPos: 'top',
            class: 'parentnode cellid',
            tooltip: ' ',
            shape: 'box',
            margin: 5
          });
        }
      }
    });

    Object.keys(that.outputNodes).forEach(function (a: any) {
      let parent = 'cluster_Out[' + a + ']';
      if (that.dataflow || that.selected) {
        let cell = a + '-Cell';
        g.setNode(cell, {
          label: 'Cell[' + a + ']',
          class: 'child-node prompt output_prompt cellid',
          labelStyle: that.labelstyles,
          style: 'invis',
          peripheries: 0,
          height: 0,
          width: 0,
          margin: '0,0',
          tooltip: ' ',
          shape: 'point',
          id: cell
        });
        g.setParent(cell, parent);
      }
      that.outputNodes[a].forEach(function (t: string) {
        //var uuid = t.substr(4,uuid_length);
        //FIXME: Make this more robust so it uses uuid_length
        if (/cluster_Out\_[a-f0-9]{8}/.test(t)) {
          g.setNode(a + t, {
            label: parent,
            class: 'child-node prompt output_prompt cellid',
            labelStyle: that.labelstyles,
            tooltip: ' ',
            shape: 'box',
            id: a + t,
            width: 0.2,
            height: 0.05,
            margin: '0.1,0.01'
          });
          g.setParent(a + t, parent);
        } else {
          g.setNode(a + t, {
            label: t,
            class: 'child-node prompt output_prompt cellid',
            labelStyle: that.labelstyles,
            tooltip: ' ',
            shape: 'box',
            id: a + t,
            width: 0.2,
            height: 0.05,
            margin: '0.1,0.01'
          });
          g.setParent(a + t, parent);
        }
      });
    });

    that.cellLinks.forEach(function (a: any) {
      if (g.hasNode(a.source) && g.hasNode(a.target)) {
        g.setEdge(a.source, a.target, {
          class:
            a.source.substr(0, uuidLength) +
            a.target.substr(0, uuidLength) +
            ' viz-' +
            a.source,
          id: 'viz-' + a.source + a.target,
          lhead: 'cluster_Out[' + a.target.substr(0, uuidLength) + ']'
        });
      }
    });

    if (that.debugMode) {
      console.log(that.cellList);
      console.log(that.outputNodes);
      console.log(that.cellLinks);
      console.log(g.children());
      console.log(g.nodes());
      console.log(g.edges());
      console.log(Writer.write(g));
    }

    return g;
  };

  /** @method this opens and closes the depviewer **/
  toggleDepView = function () {
    let that = this;
    if (this.isOpen) {
      that.closeDiv();
    } else {
      that.isOpen = true;

      //that.active_cell = Jupyter.notebook.get_selected_cell().uuid;

      //FIXME: Doesn't currently exist in this version
      //var deleted_cells = Object.keys(Jupyter.notebook.metadata.hl_list || []);
      //that.decorate_cells(deleted_cells,'deleted-cell',true);

      //FIXME: Possibly change this?
      //GraphViz relies on the size of the svg to make the initial adjustments so the svg has to be sized first
      d3.select(that.parentdiv)
        .transition()
        .delay(100)
        .style('height', '60vh')
        .on('end', function () {
          if (that.dfgraph.wasChanged) {
            that.doneRendering = false;
            that.startGraphCreation();
          }
        });

      d3.select('.end_space').transition().delay(100).style('height', '60vh');
      that.depdiv.style.display = 'block';
    }
  };

  /** @method starts graph creation **/
  startGraphCreation = function () {
    let that = this;
    let g = this.createNodeRelations();
    this.createGraph(g);
    that.dfgraph.wasChanged = false;
  };

  /** @method set graph, sets the current activate graph to be visualized */
  setGraph = function (graph: any) {
    this.dfgraph = graph;
  };
  //
  //
}
