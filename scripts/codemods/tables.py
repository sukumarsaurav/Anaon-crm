#!/usr/bin/env python3
"""Table a11y/responsive pass. Usage: tables.py [--write]
 - wraps <table> in overflow-x-auto when missing
 - adds scope="col" to <th> inside <thead>
 - >=7 columns: sticky first column inside the scroll wrapper
Skips printable document views. Dry-run by default; prints a summary of what would change."""
import re, glob, sys
WRITE='--write' in sys.argv
SKIP=re.compile(r'DataTable|AllotmentLetterView|DemandLetterView|CostSheetView|CsvImport|LeadsTable|graphify')
STICKY='[&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:bg-slate-50 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:bg-white'
tot={'wrap':0,'scope':0,'sticky':0}
for p in sorted(glob.glob('src/**/*.tsx',recursive=True)):
    if SKIP.search(p): continue
    s=open(p).read()
    if '<table' not in s: continue
    o=s; pos=0; out=[]
    for m in list(re.finditer(r'<table\b[^>]*>',s)):
        end=s.index('</table>',m.start())+len('</table>')
        seg=s[m.start():end]
        head_end=seg.find('</thead>')
        head=seg[:head_end] if head_end>0 else ''
        cols=len(re.findall(r'<th\b',head))
        new_seg=seg
        if head:
            def th(mm):
                a=mm.group(1)
                return mm.group(0) if 'scope=' in a else '<th scope="col"'+a+'>'
            new_seg2=re.sub(r'<th\b((?:\s[^>]*)?)>',lambda mm: th(mm),new_seg[:head_end+8])+new_seg[head_end+8:]
            tot['scope']+=new_seg2.count('scope="col"')-new_seg.count('scope="col"'); new_seg=new_seg2
        pre=s[max(pos,m.start()-400):m.start()]
        wrapped='overflow-x-auto' in pre.split('\n')[-1] or 'overflow-x-auto' in ''.join(pre.split('\n')[-3:])
        before=''; after=''
        if not wrapped:
            cls='overflow-x-auto'+(' '+STICKY if cols>=7 else '')
            before=f'<div className="{cls}">'; after='</div>'; tot['wrap']+=1
            if cols>=7: tot['sticky']+=1
        elif cols>=7:
            # extend nearest preceding wrapper class
            idx=s.rfind('overflow-x-auto',max(0,m.start()-400),m.start())
            if idx>=0 and STICKY not in s[idx:idx+300]:
                out.append(s[pos:idx]); out.append('overflow-x-auto '+STICKY); pos=idx+len('overflow-x-auto'); tot['sticky']+=1
        out.append(s[pos:m.start()]); out.append(before+new_seg+after); pos=end
    out.append(s[pos:]); s2=''.join(out)
    if s2!=o:
        print(('WRITE ' if WRITE else 'would change ')+p)
        if WRITE: open(p,'w').write(s2)
print(tot)
