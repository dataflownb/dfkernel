//UUID length has been changed need to compensate for that
//FIXME: Future Include?
//const uuid_length = 8;

import * as d3 from "d3";
import $ from "jquery";

export class Minimap {


    radius : Number;
    offset_x : Number;
    svg_offset_x : Number;
    svg_offset_y : Number;
    text_offset : Number;
    state_offset : Number;
    cells : { [name:string]: string};
    edges : any;
    parentdiv : any;
    svg: any;
    dfgraph: any;
    was_created: boolean;
    output_tags : {[name:string]:[]}
    tracker : any;
    order : any;
    order_fixed : any;
    mode : string;
    fixed_identifier : string;
    toggle: any;
    tabular: any;
    colormap: any;

    constructor(dfgraph?: any, parentdiv?: any) {
            this.was_created = false;
            this.radius = 3;
            this.offset_x = 15;
            this.svg_offset_x = 32;
            this.svg_offset_y = 50;
            this.text_offset = 40;
            this.state_offset = 63;
            this.fixed_identifier = "DFELEMENT"
            this.cells = {};
            this.parentdiv = parentdiv || '#minimap';
            this.edges = [];
            this.output_tags = {};
            this.dfgraph = dfgraph || null;
            this.tracker = null;
            this.toggle = null;
            this.tabular = null;
            //this.mode = 'cells';
            this.mode = 'nodes';
            this.colormap = {'Stale':'yellow','Fresh':'blue','Upstream Stale':'orange'};
            //this.widget =
    }

    setTracker = function(tracker:any){
        this.tracker = tracker;
    }

    updateOrder = function(order:any){
        this.order = order;
        //update minimap appearance based on order changes
    }

    /** @method resets all paths **/
    reset = function(){
        this.svg.selectAll('.active').classed('active',false);
        this.svg.selectAll('.imm').classed('imm',false);
        this.svg.selectAll('.active_node').classed('active_node',false);
        this.svg.selectAll('.move_left').classed('move_left',false);
        this.svg.selectAll('.move_right').classed('move_right',false);
        this.svg.selectAll('.hidden').classed('hidden',false);
        this.svg.selectAll('.gray').classed('gray',false);
        this.svg.selectAll('.joining').remove();
        this.svg.selectAll('.activeedge').remove();
   }


   /** @method creates paths between node segments **/
    makePaths = function(source:any,destination:any,parent:any,left:boolean)
    {
        let x_val = left ? this.svg_offset_x+this.radius+8 : this.svg_offset_x-(this.radius+8);
        let y_val = ((destination.attr('cy') - source.attr('cy')));
        parent.append('path').classed('joining',true).attr('d','M'+ x_val +' ' + source.attr('cy') + 'v '+y_val).attr('stroke-width',2);
    }

    /** @method generates dependencies that aren't intermediates **/
     genDeps = function(immups:any,immdowns:any){
      let that = this;
      let ups:any = [];
      let downs:any = [];
      let currups = immups;
      let currdowns = immdowns;
      while(currups.length > 0 || currdowns.length > 0){
        let newups:any = [];
        let newdowns:any = [];
        that.edges.map(function(edge:any){
                  if(currups.includes(edge['destination'])){
                    newups.push(edge['source']);
                    ups.push(edge['source']);
                  }
                  if(currdowns.includes(edge['source'])){
                    newdowns.push(edge['destination']);
                    downs.push(edge['destination']);
                  }

                  });
        currups = newups;
        currdowns = newdowns;
      }
      ups.map(function(up:any){
        d3.select('#node'+up).classed('move_right',true).classed('active',true).classed('gray',true);
      })
      downs.map(function(down:any){
       d3.select('#node'+down).classed('move_left',true).classed('active',true).classed('gray',true);
      })
    }


   /** @method activates the paths based on click **/
    elementActivate = function(parent:any,node:any)
    {
       let that = this;
       let ups:any = [];
       let downs:any = [];
       if(!node.classed('active_node'))
       {
        this.reset();
        node.classed('active_node',true);
        parent.classed('active',true);
        let active_id = parent.attr('id');
        active_id = active_id.substring(4,active_id.length);

        let source_x = that.svg_offset_x;
        let offset_active = 0;

        let source_y = 10+that.offset_x*that.order_fixed.indexOf(active_id);
        let uuid = active_id.substring(active_id.length-8,active_id.length);
        let immups = that.dfgraph.get_imm_upstreams(uuid);
        let immdowns = that.dfgraph.get_downstreams(uuid);
        if(immups.length > 0 && immdowns.length > 0){
            source_x = that.svg_offset_x - 12;
            offset_active = 24;
        }
        else if(immups.length > 0){
            offset_active = -12;
        }
        else if(immdowns.length > 0){
            offset_active = 12;
        }

        let active_ele = '#node'+active_id;

        d3.select(active_ele).append('g')
        .attr('transform','translate(0,0)')
        .classed('activeedge',true)
        .append('path')
        .classed('source',true)
        .attr('d','M'+ source_x +' ' + source_y + 'h '+offset_active)
        .attr('stroke-width',2).attr('fill','#3b5fc0')
        .attr('stroke',"#3b5fc0");


        d3.select('#text'+active_id).classed('active',true);
        if(that.mode == 'cells'){
            this.tracker.currentWidget.content.activeCellIndex = this.order.indexOf(active_id);
           }
       else{
            this.tracker.currentWidget.content.activeCellIndex = this.order.indexOf(active_id.split(that.fixed_identifier)[1]);
       }
        this.edges.map(function(edge:any)
        {
          let source = edge['source'];
          let destination = edge['destination'];
          if(source == active_id){
            downs.push(destination);
          let destination_node = d3.select('#node'+destination).classed('move_left',true).classed('active',true).classed('imm',true);
          let dest = destination_node.select('circle');
            that.makePaths(node,dest,parent,true);

            destination_node.selectAll('path.source').classed('hidden',true);
          }
          if(destination == active_id){
              ups.push(source);
            let source_node = d3.select('#node'+source).classed('move_right',true).classed('active',true).classed('imm',true);
            let src = source_node.select('circle');
            that.makePaths(src,node,parent,false);

            source_node.selectAll('path.destination').classed('hidden',true);
          }
        })
       }
       that.genDeps(ups,downs);
       this.svg.selectAll('g').filter(function(a:any){ return (!(this.classList.contains('active')) && this.parentElement.nodeName == "svg");}).selectAll('path').classed('hidden',true);


    }

    /** @method takes in a string id input and activates based on that ID*/
    updateActiveByID = function(activeid:string){
            let source_node = null;
            let src = null;
            if(this.mode == 'nodes'){
                let deps = this.dfgraph.get_nodes(activeid);
                let add_specifier = deps.length > 0 ? deps[0] : "";
                if (deps.length > 0 && deps[0] == undefined){
                add_specifier = "";
                }
                console.log('#node'+activeid+add_specifier);
                source_node = d3.select('#node'+add_specifier+this.fixed_identifier+activeid).classed('move_right',true).classed('active',true);
                src = source_node.select('circle');
            }
            else{
                source_node = d3.select('#node'+activeid).classed('move_right',true).classed('active',true);
                src = source_node.select('circle');
            }
            this.elementActivate(source_node,src);
    }

   /** @method combines tags with respective uuids **/
   combine_tags = function(uuid:string)
   {
        let that = this;
        if(uuid in this.output_tags){
            if(this.dfgraph.get_nodes(uuid).length == 0){ return [''+that.fixed_identifier+uuid]; }
            return this.output_tags[uuid].map((tag:string) => ((tag ? tag : '')+that.fixed_identifier+uuid));
        }
        return this.dfgraph.get_nodes(uuid);
   }

    /** @method update_states updates the states present in the graph */
    update_states = function(){
            let that = this;
            let decoffset = 0;
            that.svg.selectAll('rect.states')
            .data(Object.keys(that.dfgraph.states))
            .attr('fill',(uuid:string) => that.colormap[that.dfgraph.states[uuid]])
            .enter()
            .append('rect')
            .attr('x',that.state_offset)
            .attr('y',function(a:string,b:number){
                    let curroffset = decoffset;
                    let node = a[0];
                    let node_length = that.out_tags_length(node);
                    decoffset = decoffset + node_length;
                    if(node_length > 1){
                        return 4+(that.offset_x*curroffset)+(that.offset_x/(node_length));
                    }
                    return 4+(that.offset_x*curroffset);
                    })
            .attr('width','5px')
            .attr('height','12px')
            .attr('rx','2px')
            .attr('ry','2px')
            .attr('fill',(uuid:string) => that.colormap[that.dfgraph.states[uuid]])
            .classed('states',true);
    }

   /** @method combines tags with respective uuids **/
   out_tags_length = function(uuid:string)
   {
        if(uuid in this.output_tags){
            if(this.output_tags[uuid].length == 0){ return 1; }
            return this.output_tags[uuid].length;
        }
        return 1;
   }

   /** @method activates the paths based on click **/
    createMinimap = function(parent:any,node:any)
    {
        let that = this;

        let minitran = d3.transition()
            .duration(0);

        let circles = this.svg.selectAll('circle');
        let data = null;
        if(that.mode == 'cells'){
            data = this.order;
        }
        else{
            data = this.order.reduce(function(a:any,b:any){return a.concat(that.combine_tags(b))},[]);
        }

        let groups = circles
        .data(data,(a:string)=>a)
        .enter()
        .append('g')
        //Have to use a proper start pattern for ID rules in HTML4
        .attr('id',(a:string)=>'node'+a);

        groups.append('rect')
        .attr('x',0)
        .attr('y',(a:string,b:number)=>0+b*15)
        .attr('width',500)
        .attr('height',15)
        .attr('fill','transparent')
        .on('click',function()
         {
            let parent = d3.select(this.parentNode);
            let node = parent.select('circle');
            that.elementActivate(parent,node);
        });

        groups.append('circle')
          .transition(minitran)
          .attr('cx', this.svg_offset_x)
          .attr('cy',(a:string,b:number)=> 10+this.offset_x*b)
          .attr('r',this.radius);

        that.mapEdges(that);

        let grab_out_tags = function(id:string,text:string){
            if(id in that.output_tags){
                return that.output_tags[id].reduce((textobj:string,output_tag:string)=>{
                    //FIXME: Make this smarter
                    let exp = new RegExp(output_tag);
                    return textobj.replace(exp,'OUTTAGSTARTSHERE'+output_tag+'OUTTAGSTARTSHERE');
                },text);
            }
                return text || "";
        }

        let values = this.order
            .map((a:string)=>[a,
                grab_out_tags(a,this.cells[a])
                .split("OUTTAGSTARTSHERE")
                .map(
                (text:string)=>{
                return [text,(that.output_tags[a] || []).includes(text)]
                }
                )
            ]);


        let textclick = function(){
            let id = d3.select(this).attr('id');
            id = id.substring(4,id.length);
            let parent = d3.select('#node'+id);
            let node = parent.select('circle');
            that.elementActivate(parent,node);
        }

        if(that.mode == 'nodes')
        {
            let full_source = values;
            values = that.order.reduce(function(a:any,b:any){return a.concat((that.get_nodes(b)).map((tag:any) => ([tag ? '' : tag+that.fixed_identifier+b,[[tag,true]]])))},[]);
            let decoffset = 0;
            that.svg.selectAll('rect.cells')
            .data(that.order)
            .enter()
            .append('rect')
            .classed('cells',true)
            .attr("x",8)
            .attr("y",function(node:string){
                    let curroffset = decoffset;
                    decoffset = decoffset + that.out_tags_length(node);
                    return 4 + curroffset * 15
                    })
            .attr("width",50)
            .attr('height',(node:string) => 15*that.out_tags_length(node)-4)
            .attr('rx',3)
            .attr('ry',3);

            decoffset = 0;

            this.svg.selectAll('text.source')
            .data(full_source, function(a:any){return a[0]})
            .each(function(a:any){
                //For existing ones clear all text
                //FIXME: This is a biproduct of not having full access to tags on load
                $(this).empty();
                d3.select(this)
                .selectAll('tspan')
                .data(a[1])
                .enter()
                .append('tspan')
                .text(function(a:any){
                    if(a[0]){ return a[0];}
                    return "";
                })
                .classed('outtag',(a:any)=>a[1]);
            })
            .on('click',textclick)
            .enter()
            .append('text')
            .on('click',textclick)
            .attr('id',(a:Array<string>)=> 'text'+a[0])
            .attr('x',that.text_offset+that.svg_offset_x+70)
            .attr('y',function(a:Array<string>,b:number){
                    let curroffset = decoffset;
                    let node = a[0];
                    let node_length = that.out_tags_length(node);
                    decoffset = decoffset + node_length;
                    if(node_length > 1){
                        return 15+(that.offset_x*curroffset)+(that.offset_x/(node_length));
                    }
                    return 15+(that.offset_x*curroffset);
                    })
            .on('click',textclick)
            .each(function(a:any){
                d3.select(this)
                .selectAll('tspan')
                .data(a[1])
                .enter()
                .append('tspan')
                .text(function(a:any){
                    if(a[0]){ return a[0];}
                    return "";
                })
                .classed('outtag',(a:any)=>a[1]);
            })

            decoffset = 0;
            this.svg.selectAll('rect.states')
            .data(Object.keys(that.dfgraph.states))
            .attr('fill',(uuid:string) => that.colormap[that.dfgraph.states[uuid]])
            .enter()
            .append('rect')
            .attr('x',that.state_offset)
            .attr('y',function(a:string,b:number){
                    let curroffset = decoffset;
                    let node = a[0];
                    let node_length = that.out_tags_length(node);
                    decoffset = decoffset + node_length;
                    if(node_length > 1){
                        return 4+(that.offset_x*curroffset)+(that.offset_x/(node_length));
                    }
                    return 4+(that.offset_x*curroffset);
                    })
            .attr('width','5px')
            .attr('height','12px')
            .attr('rx','2px')
            .attr('ry','2px')
            .attr('fill',(uuid:string) => that.colormap[that.dfgraph.states[uuid]])
            .classed('states',true);
        }




        this.svg.selectAll('text')
        .data(values, function(a:any){return a[0]})
        .each(function(a:any){
            //For existing ones clear all text
            //FIXME: This is a biproduct of not having full access to tags on load
            $(this).empty();
            d3.select(this)
            .selectAll('tspan')
            .data(a[1])
            .enter()
            .append('tspan')
            .text(function(a:any){
            if(a[0]){
                return a[0].length > 10 ? a[0].substring(0,7)+".." : a[0];
            }
                return "";
            })
            .classed('outtag',(a:any)=>a[1]);
        })
        .on('click',textclick)
        .enter()
        .append('text')
        .on('click',textclick)
        .attr('id',(a:Array<string>)=> 'text'+a[0])
        .attr('x',this.text_offset+this.svg_offset_x)
        .attr('y',(a:Array<string>,b:number)=> 15+this.offset_x*b)
        .on('click',textclick)
        .each(function(a:any){
            d3.select(this)
            .selectAll('tspan')
            .data(a[1])
            .enter()
            .append('tspan')
            .text(function(a:any){
            if(a[0]){
                return (a[0].length > 10 ? a[0].substring(0,7)+".." : a[0]);
            }
            return "";
            })
            .classed('outtag',(a:any)=>a[1]);
        })


    }

    /** @method this method is mostly here to make sure we return something for display purposes **/
    get_nodes = function(uuid:string){
        let nodes = this.dfgraph.get_nodes(uuid);
        if(nodes.length == 0){ return [uuid]; }
        return nodes;
    }

    /** @method maps edges to incoming and outgoing paths in the svg **/
    mapEdges = function(parent:any,node:any){
        let that = this;
        if(that.mode == 'cells'){
            that.order_fixed = this.order;
        }
        else{
            that.order_fixed = this.order.reduce(function(a:any,b:any){return a.concat(that.combine_tags(b))},[]);
        }
        let edgelist:{[index: string]:any} = {};//:;
        this.edges.map(function(edge:any){
             let source_id = '#node'+edge['source'];
             let destination_id = '#node'+edge['destination'];

             if(source_id in edgelist) {
                if(edgelist[source_id].includes(destination_id)){return;}
                edgelist[source_id].push(destination_id);
             }
             else{ edgelist[source_id] = [destination_id]; }
             let source_x = that.svg_offset_x;
             let source_y = 10+that.offset_x*that.order_fixed.indexOf(edge['source']);
             let destination_x = that.svg_offset_x;
             let destination_y = 10+that.offset_x*that.order_fixed.indexOf(edge['destination']);

             d3.select(source_id).append('g')
             .attr('transform','translate(0,0)')
             .attr('id','edge'+edge['source'])
             .append('path')
             .classed('source',true)
             .attr('d','M'+ source_x +' ' + source_y + 'h 8')
             .attr('stroke-width',2).attr('fill','none')
             .attr('stroke',"black");

             d3.select(destination_id).append('g')
             .attr('transform','translate(0,0)')
             .attr('id','edge'+edge['source'])
             .append('path')
             .classed('destination',true)
             .attr('d','M'+ destination_x +' ' + destination_y + 'h -8')
             .attr('stroke-width',2)
             .attr('fill','none')
             .attr('stroke',"black");

     })
    }


    /** @method changes cell contents **/
    // Always call before any updates to graph
    update_cells = function(){
        let that = this;
        that.cells = Object.keys(this.dfgraph.cell_contents).reduce(function(a:any,b:string)
        {
          let split_cell = that.dfgraph.cell_contents[b].split('\n');
          a[b] = split_cell[split_cell.length - 1];
          return a;
          },{})
    }

    /** @method updates the edges in the minimap */
    //Always call before any updates to graph
    update_edges = function(){
        let that = this;
        if(this.mode == 'cells'){
            const flatten = (arr:any[]) =>  arr.reduce((flat:any[], next:any[]) => flat.concat(next), []);
            let edges = that.dfgraph.downlinks;
            that.edges = flatten(Object.keys(edges).map(function(edge){return edges[edge].map(function(dest:string){return{'source':edge,'destination':dest}})}));
        }
        else{
            const flatten = (arr:any[]) =>  arr.reduce((flat:any[], next:any[]) => flat.concat(next), []);
            let edges = that.dfgraph.uplinks;
            //FIXME: This is really convoluted and it should be able to be rewritten
            that.edges = flatten(flatten(Object.keys(edges).map(function(edge){return flatten(Object.keys(edges[edge]).map(function(source:string){return edges[edge][source].map(function(node:string){return that.output_tags[edge].map(function(destnode:string){ return {'source':node+that.fixed_identifier+source,'destination':destnode+that.fixed_identifier+edge}})})}))})));
        }
    }

    /** @method creates the starting environment for first time setup*/
    createMiniArea = function(svg:any){
        (async() => {
            while($('#minisvg').height() === 0) // wait until the main div has a size to do anything
                await new Promise(resolve => setTimeout(resolve, 100));
                d3.select('#minimap').classed('container',true);
                let that = this;
                this.svg = d3.select('#minisvg');
                this.svg = this.svg.append('g');
                this.svg.attr('transform','translate(0,0)');
                this.toggle = d3.select('#minimap').append('div').attr('id','side-panel-mini');
                this.tabular = this.toggle.append("div").attr('id', 'table').classed('card', true);
                let label = this.tabular.append('label').classed('switch',true);
                label.append('input').attr('type','checkbox').on('change',function(){that.changeMode();});
                label.append('span').classed('slider',true).classed('round',true);
                this.startMinimapCreation();
        })();
    };


    /** @method clear graph */
    clearMinimap = function(){
        $('#minisvg g').empty();
    }

    /** @method updates the list of output_tags on the graph */
    update_output_tags = function(){
        let that = this;
        that.dfgraph.get_cells().forEach(function(uuid:string){
            that.output_tags[uuid] = that.dfgraph.get_nodes(uuid);
        });
    }

    /** @method starts minimap creation, this is the process that's ran every time **/
    startMinimapCreation = function(){
        this.update_cells();
        this.update_output_tags();
        this.update_edges();
        this.createMinimap();
    };

    /** @method changes the current mode in which the minimap is being displayed */
    changeMode = function(){
        let that = this;
        that.mode = that.mode == 'nodes' ? 'cells' : 'nodes';
        that.clearMinimap();
        that.startMinimapCreation();
    }


    /** @method set graph, sets the current activate graph to be visualized */
    set_graph = function(graph:any){
        this.dfgraph = graph;
    }

}