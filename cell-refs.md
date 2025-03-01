# Cell References

We want to balance the ability to reference specific outputs from identified cells in a way that persists, leading to a deterministic trail of executions. This is facilitated by appending the cell id to the variable name. If we have cells `43de1f` and `f341d3` that both output a variable `df`, we can write the individual outputs as `df$43de1f` and `df$f341d3`. Because a cell's id is immutable, these references are persistent and stable. However, we may want different semantics when executing code. 

## Qualifiers

We may want a variable to reference the **latest** version of `df` each time the cell is manually run. This may change the persistent identifer on each execution. We can allow a user to encode this by adding the caret symbol (`^`) to indicate the most recent version of the identifier. Each time the cell is run, the current identifier is ignored and updated to reference whatever the latest definition is. Thus, the code `df$^43de1f` shows that the last time the cell was run, it referenced the output from `43de1f`, but if cell `f341d3` was run most recently, the next run will update this reference to `df$^f341d3` before executing the cell. (One thing that isn't clear yet is what should happen when this cell is a dependency of a downstream cell that is executing...)

We may also want to make sure that a reference persists at all times. We can add the `=` qualifier to the identifier to make sure that only that cell is referenced. Here, the code `df$=43de1f` will always reference cell `43de1f`, and it will generate an error if that cell doesn't exist. (Currently, this doesn't substantially differ from the normal `df$43de1f` reference)

## Tags

Often, we may wish to refer to a cell with a more meaningful tag rather than a persistent id. Here, we can refer to the tag first and (usually) auto-append the persistent id after it. Thus, a reference of `df$main` refers the `df` defined in the cell tagged as `main`. When that cell is executed, we append the persistent id to the tag as `df$main:43de1f`. By default, this is treated as `df$~main:43de1f`. This means that if `main` changes, we will update the persistent id accordingly. If we use the `=` qualifier, this references the persistent id. Thus`df$=main:43de1f` will effectively only reference `43de1f` (the tag is only for the user). If the tag is moved or deleted, this reference should change to `df$=43de1f`. If we use the `^` qualifier, we have similar behavior in that we only view this as `df$^43de1f`; the tag is effectively ignored but useful as a marker for readers.

We should probably allow cells to be tagged as `%tag <name>` as well as through the Jupyter interface. This also means that `:` needs to be an invalid character for a tag (along with spaces).