//UUID length has been changed need to compensate for that
//FIXME: Future Include?
//const uuid_length = 8;

import * as d3 from "d3";


export class Minimap {


    radius : Number;
    offset_x : Number;
    svg_offset_x : Number;
    svg_offset_y : Number;
    text_offset : Number;
    cells : { [name:string]: string};
    edges : any;
    //edges :  [{source:string,destination:string}]
    parentdiv : any;
    svg: any;
    is_open: boolean;

    constructor(dfgraph?: any, parentdiv?: any) {
            this.is_open = false;
            this.radius = 3;
            this.offset_x = 15;
            this.svg_offset_x = 18;
            this.svg_offset_y = 50;
            this.text_offset = 40;
            this.cells = {zzz:'print("Hello World")',
                    aaa:'a = 3',
                    bbb:'b=a+3',
                    eee:"#I'm just going to write a comment",
                    ccc:'c = a+b',
                    ddd:'print(c)',
                    lll:"Print('Im Done')"};
            this.parentdiv = parentdiv || 'div#minimap';

            //console.log('svg',this.svg);
            this.edges = [{'source':'aaa','destination':'bbb'},{'source':'bbb','destination':'ccc'},{'source':'aaa','destination':'ccc'},
            {'source':'ccc','destination':'ddd'}]
    }

    /** @method resets all paths **/
    reset = function(){
        this.svg.selectAll('.active').classed('active',false);
        this.svg.selectAll('.active_node').classed('active_node',false);
        this.svg.selectAll('.move_left').classed('move_left',false);
        this.svg.selectAll('.move_right').classed('move_right',false);
        this.svg.selectAll('.hidden').classed('hidden',false);
        this.svg.selectAll('.joining').remove();
   }


   /** @method creates paths between node segments **/
    makePaths = function(source:any,destination:any,parent:any,left:boolean)
    {
        let x_val = left ? this.svg_offset_x+this.radius+4 : this.svg_offset_x-(this.radius+4);
        let y_val = (Math.abs(destination.attr('cy') - source.attr('cy')));
        parent.append('path').classed('joining',true).attr('d','M'+ x_val +' ' + source.attr('cy') + 'v '+y_val).attr('stroke-width',2);
    }

   /** @method activates the paths based on click **/
    elementActivate = function(parent:any,node:any)
    {
       if(!node.classed('active_node'))
       {
        this.reset();
        node.classed('active_node',true);
        parent.classed('active',true);
        let active_id = parent.attr('id');
        //FIXME: Use uplinks/downlinks here
        this.edges.map(function(edge:any)
        {
          let source = edge['source'];
          let destination = edge['destination'];
          if(source == active_id){

          let destination_node = d3.select('#'+destination).classed('move_left',true).classed('active',true);
          let dest = destination_node.select('circle');
            this.makePaths(node,dest,true,parent);

            destination_node.selectAll('path.source').classed('hidden',true);
          }
          if(destination == active_id){
            let source_node = d3.select('#'+source).classed('move_right',true).classed('active',true);
            let src = source_node.select('circle');
            this.makePaths(src,node,false,parent);

            source_node.selectAll('path.destination').classed('hidden',true);
          }
        })
       }
    }

   /** @method activates the paths based on click **/
    public createMinimap = function(parent:any,node:any)
    {

        let circles = this.svg.selectAll('circle');
        console.log(circles);
        let groups = circles
        .data(Object.keys(this.cells))
        .enter()
        .append('g')
        .attr('id',(a:string)=>a);

        console.log('groups',groups);

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
            this.elementActivate(parent,node);
        });

        groups.append('circle')
          .attr('cx', this.svg_offset_x)
          .attr('cy',(a:string,b:number)=> 10+this.offset_x*b)
          .attr('r',this.radius);

        console.log('circles',this.svg.selectAll('circle'))

        let values = Object.keys(this.cells)
        .map((a:string)=>[a,this.cells[a]]);

        this.svg.selectAll('text')
        .data(values)
        .enter()
        .append('text')
        .text((a:Array<string>)=>a[1])
        .attr('id',(a:Array<string>)=>a[0])
        .attr('x',this.text_offset+this.svg_offset_x)
        .attr('y',(a:Array<string>,b:number)=> 15+this.offset_x*b)
        .on('click',function()
        {
            let id = d3.select(this).attr('id');
            let parent = d3.select('#'+id);
            let node = parent.select('circle');
            this.elementActivate(parent,node);
        });
    }

    /** @method maps edges to incoming and outgoing paths in the svg **/
    mapEdges = function(parent:any,node:any){
        console.log('edges',this.edges);
        this.edges.map(function(edge:any){
             let source_id = '#'+edge['source'];
             let destination_id = '#'+edge['destination'];
             let source = d3.select(source_id).select('circle');
             let destination = d3.select(destination_id).select('circle');
             console.log(source,destination);
             let source_x = source.attr('cx');
             let source_y = source.attr('cy');
             console.log(source_x,source_y);

             d3.select(source_id).append('g')
             .attr('transform','translate(0,0)')
             .attr('id',edge['source'])
             .append('path')
             .classed('source',true)
             .attr('d','M'+ source_x +' ' + source_y + 'h 8')
             .attr('stroke-width',2).attr('fill','none')
             .attr('stroke',"black");

             let destination_x = destination.attr('cx');
             let destination_y = destination.attr('cy');

             d3.select(destination_id).append('g')
             .attr('transform','translate(0,0)')
             .attr('id',edge['source'])
             .append('path')
             .classed('destination',true)
             .attr('d','M'+ destination_x +' ' + destination_y + 'h -8')
             .attr('stroke-width',2)
             .attr('fill','none')
             .attr('stroke',"black");

//              let start = (source.attr('cx'),source.attr('cy'));
//              let end = (destination.attr('cx'),source.attr('cy'));
     })
    }

    /** @method starts minimap creation **/
    public startMinimapCreation = function(){
        this.svg = d3.select('#minisvg').append('g');
        this.svg.attr('transform','translate(0,0)');
        this.createMinimap();
        this.mapEdges();
        //FIXME: Add a flag similar to graph was changed
//                 that.dfgraph.was_changed = false;
    };


}