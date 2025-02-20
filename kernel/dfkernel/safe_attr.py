# This code was written by Box developers
# https://github.com/cdgriffith/Box/blob/master/box.py
# Retrieved on August 23, 2017 (a537f46b5b85f0f920fac6282e0113df13e4caa4)

# MIT License
#
# Copyright (c) 2017 Chris Griffith
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

import re
import string

ILLEGAL_ATTRIBUTES = ('if', 'elif', 'else', 'for', 'from', 'as', 'import',
                      'in', 'not', 'is', 'def', 'class', 'return', 'yield',
                      'except', 'while', 'raise')
DEFAULT_STARTING_CHAR = 'o' # changed from 'x'

_first_cap_re = re.compile('(.)([A-Z][a-z]+)')
_all_cap_re = re.compile('([a-z0-9])([A-Z])')

def _safe_key(key):
    try:
        return str(key)
    except UnicodeEncodeError:
        return key.encode(encoding="utf-8", errors="ignore")

def _camel_killer(attr):
    """
    CamelKiller, qu'est-ce que c'est?
    Taken from http://stackoverflow.com/a/1176023/3244542
    """
    try:
        attr = str(attr)
    except UnicodeEncodeError:
        attr = attr.encode(encoding="utf-8", errors="ignore")

    s1 = _first_cap_re.sub(r'\1_\2', attr)
    s2 = _all_cap_re.sub(r'\1_\2', s1)
    return re.sub('_+', '_', s2.casefold() if hasattr(s2, 'casefold') else
    s2.lower())

def safe_attr(attr, camel_killer=False):
    """Convert a key into something that is accessible as an attribute"""
    allowed = string.ascii_letters + string.digits + '_'

    attr = _safe_key(attr)

    if camel_killer:
        attr = _camel_killer(attr)

    attr = attr.replace(' ', '_')

    out = ''
    for character in attr:
        out += character if character in allowed else "_"
    out = out.strip("_")

    try:
        int(out[0])
    except (ValueError, IndexError):
        pass
    else:
        out = '{}{}'.format(DEFAULT_STARTING_CHAR, out)

    if out in ILLEGAL_ATTRIBUTES:
        out = '{}{}'.format(DEFAULT_STARTING_CHAR, out)

    return re.sub('_+', '_', out)
