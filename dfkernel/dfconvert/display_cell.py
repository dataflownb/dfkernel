display_variable_cell = display_variable_cell = [{ "cell_type": "code", "execution_count": None, "id": "1", "metadata": {}, "outputs": [], "source":'''from IPython.display import display, HTML
import html
def display_variables(variables):
    """
    Used for printing variables(Referred in DFPython 3 notebook)
    Args:
    - variables (dict): A dictionary containing variable names as keys and their corresponding values.
    """
    html_template = """
    <style>.jp-RenderedHTMLCommon tbody tr:nth-child(even) {{ background: none; }}</style>
    <div style='opacity:80%;font-size:12px;padding-left: 6px'><br>DFPython 3 referred variables</div>
    <table>{}</table>"""
    
    row_template = "<tr style='opacity: 70%'><td style='color: #bf5b3d;text-align:left'>{}</td><td style='text-align:left'> {}</td></tr>"
    rows = [row_template.format(name+':', value._repr_html_()) if hasattr(value, '_repr_html_') else row_template.format(name+':', html.escape(str(value))) for name, value in variables.items()]
    output_html = html_template.format("\\n".join(rows))
    output_html = f"<div style='pointer-events: none;'>{output_html}</div>"
    display(HTML(output_html))'''
}]