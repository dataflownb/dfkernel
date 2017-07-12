Usage
=====

General Usage
-------------

Cells Outputs may be referenced as variables at any point in time with the use of Out[' + unique cell_id + '] such as
    
	>> Out['aaaaaa']


Completer
---------

The use of _ + <tab> gives the user the ability to reference the outputs of the last 3 executed cells.

Cells that have existing outputs and are uniquely identifyable can be autocompleted by pressing tab after typing two letters of the cell identifier.

    >> bd + <tab>
	
    >> Out['bd5341']
    
 