// QSSI Link - script.js (nav + simulation + editor + persistence + export)
document.addEventListener('DOMContentLoaded', () => {
  // NAV TOGGLE
  const toggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      navLinks.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !toggle.contains(e.target) && navLinks.classList.contains('show')) {
        navLinks.classList.remove('show');
        toggle.classList.remove('open');
      }
    });
  }

  /* ---------------- Simulation + Chain Editor ---------------- */
  const chainSvg = document.getElementById('chainSvg');
  const logEl = document.getElementById('log');
  const stepBtn = document.getElementById('stepBtn');
  const resetBtn = document.getElementById('resetBtn');
  const alertBtn = document.getElementById('alertBtn');
  const addNodeBtn = document.getElementById('addNodeBtn');
  const removeNodeBtn = document.getElementById('removeNodeBtn');
  const moveUpBtn = document.getElementById('moveUpBtn');
  const moveDownBtn = document.getElementById('moveDownBtn');
  const saveChainBtn = document.getElementById('saveChainBtn');
  const loadChainBtn = document.getElementById('loadChainBtn');
  const exportPNGBtn = document.getElementById('exportPNGBtn');
  const exportJSONBtn = document.getElementById('exportJSONBtn');
  const copyChainBtn = document.getElementById('copyChainBtn');

  const nodeLabelInput = document.getElementById('nodeLabel');
  const payloadTextarea = document.getElementById('payloadTextarea');
  const genPayloadBtn = document.getElementById('genPayloadBtn');
  const copyPayloadBtn = document.getElementById('copyPayloadBtn');
  const downloadPayloadBtn = document.getElementById('downloadPayloadBtn');

  // default chain
  const defaultChain = [
    { id: 'anchor', label: 'Anchor' },
    { id: 'control', label: 'Control' },
    { id: 'filter', label: 'Filter' },
    { id: 'sink', label: 'Sink' }
  ];

  // state
  let chain = [];
  let selectedIndex = null;
  let stepIndex = 0;

  const appendLog = (txt) => {
    if (!logEl) return;
    const t = document.createElement('div');
    t.textContent = `${new Date().toLocaleTimeString()} — ${txt}`;
    logEl.prepend(t);
  };

  // persistence
  const saveToStorage = () => {
    try {
      localStorage.setItem('qssi_chain', JSON.stringify(chain));
      appendLog('Chain saved to localStorage');
    } catch (e) {
      appendLog('Failed to save chain');
    }
  };

  const loadFromStorage = () => {
    try {
      const raw = localStorage.getItem('qssi_chain');
      if (!raw) { chain = JSON.parse(JSON.stringify(defaultChain)); appendLog('No saved chain found, loaded default'); return; }
      chain = JSON.parse(raw);
      appendLog('Chain loaded from localStorage');
    } catch (e) {
      chain = JSON.parse(JSON.stringify(defaultChain));
      appendLog('Failed to load chain — default used');
    }
  };

  // init
  if (chainSvg) {
    loadFromStorage();
    renderChain();
    restoreState();
  }

  function restoreState(){
    // set selection to 0 if absent
    if (chain.length > 0) selectedIndex = 0;
    updatePropertyPanel();
  }

  // render svg chain
  function renderChain(){
    if (!chainSvg) return;
    const w = chainSvg.viewBox.baseVal.width || 900;
    const h = chainSvg.viewBox.baseVal.height || 260;
    // fallback viewbox set
    chainSvg.setAttribute('viewBox', `0 0 900 260`);
    const leftMargin = 80;
    const rightMargin = 80;
    const usable = 900 - leftMargin - rightMargin;
    const spacing = (chain.length > 1) ? usable / (chain.length -1) : 0;
    // build content
    let inner = '';
    // connectors
    for (let i=0;i<chain.length-1;i++){
      const x1 = leftMargin + spacing * i;
      const x2 = leftMargin + spacing * (i+1);
      inner += `<line x1="${x1}" y1="130" x2="${x2}" y2="130" stroke="#444" stroke-width="8" class="conn-line" id="conn-${i}"></line>`;
    }
    // nodes
    chain.forEach((n, i) => {
      const x = leftMargin + spacing * i;
      const y = 130;
      inner += `
      <g class="node" data-index="${i}" transform="translate(${x},${y})" style="cursor:pointer">
        <circle r="36" fill="#0f0f10" stroke="#ff3b3b" stroke-width="6" class="node-circle" id="node-circle-${i}"></circle>
        <text x="0" y="6" text-anchor="middle" fill="#fff" font-size="12">${escapeHtml(n.label)}</text>
      </g>
      `;
    });
    chainSvg.innerHTML = inner;

    // attach listeners
    const nodes = Array.from(chainSvg.querySelectorAll('.node'));
    nodes.forEach(n => {
      n.addEventListener('click', (e) => {
        const idx = Number(n.dataset.index);
        selectNode(idx);
      });
    });

    // reset visual step colors
    nodes.forEach((n,i) => {
      const circle = n.querySelector('circle');
      circle.setAttribute('fill', '#0f0f10');
      circle.setAttribute('stroke', '#ff3b3b');
      circle.style.transition = 'all .18s ease';
    });
    const conns = Array.from(chainSvg.querySelectorAll('.conn-line'));
    conns.forEach(c => c.setAttribute('stroke','#444'));

    // highlight selection
    highlightSelection();
  }

  function escapeHtml(s) {
    return (s+'').replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function highlightSelection(){
    if (!chainSvg) return;
    const nodes = Array.from(chainSvg.querySelectorAll('.node'));
    nodes.forEach((n, i)=> {
      const circle = n.querySelector('circle');
      if (i === selectedIndex) {
        circle.classList.add('node-selected');
        circle.setAttribute('stroke-width', '5');
      } else {
        circle.classList.remove('node-selected');
        circle.setAttribute('stroke-width', '6');
      }
    });
  }

  // selection
  function selectNode(idx){
    if (idx < 0 || idx >= chain.length) return;
    selectedIndex = idx;
    highlightSelection();
    updatePropertyPanel();
    appendLog(`Selected node: ${chain[idx].label}`);
  }

  // property panel update
  function updatePropertyPanel(){
    if (!nodeLabelInput) return;
    if (selectedIndex === null || chain.length===0) {
      nodeLabelInput.value = '';
      return;
    }
    nodeLabelInput.value = chain[selectedIndex].label;
  }

  // add node
  if (addNodeBtn){
    addNodeBtn.addEventListener('click', () => {
      const newLabel = `Node ${chain.length+1}`;
      chain.push({ id: `node-${Date.now()}`, label: newLabel });
      saveToStorage();
      renderChain();
      selectNode(chain.length-1);
      appendLog(`Added node: ${newLabel}`);
    });
  }

  // remove node
  if (removeNodeBtn){
    removeNodeBtn.addEventListener('click', () => {
      if (selectedIndex === null) return;
      const removed = chain.splice(selectedIndex,1)[0];
      appendLog(`Removed node: ${removed.label}`);
      if (chain.length === 0) { selectedIndex = null; }
      else if (selectedIndex >= chain.length) { selectedIndex = chain.length -1; }
      saveToStorage();
      renderChain();
      updatePropertyPanel();
    });
  }

  // move up
  if (moveUpBtn){
    moveUpBtn.addEventListener('click', () => {
      if (selectedIndex === null || selectedIndex === 0) return;
      const tmp = chain[selectedIndex-1];
      chain[selectedIndex-1] = chain[selectedIndex];
      chain[selectedIndex] = tmp;
      selectedIndex = selectedIndex - 1;
      saveToStorage();
      renderChain();
      appendLog('Moved node up');
    });
  }

  // move down
  if (moveDownBtn){
    moveDownBtn.addEventListener('click', () => {
      if (selectedIndex === null || selectedIndex === chain.length-1) return;
      const tmp = chain[selectedIndex+1];
      chain[selectedIndex+1] = chain[selectedIndex];
      chain[selectedIndex] = tmp;
      selectedIndex = selectedIndex + 1;
      saveToStorage();
      renderChain();
      appendLog('Moved node down');
    });
  }

  // label edit
  if (nodeLabelInput){
    nodeLabelInput.addEventListener('change', () => {
      if (selectedIndex === null) return;
      const val = nodeLabelInput.value.trim();
      if (val.length === 0) return;
      chain[selectedIndex].label = val;
      saveToStorage();
      renderChain();
      appendLog(`Renamed node to: ${val}`);
    });
  }

  // save/load
  if (saveChainBtn) saveChainBtn.addEventListener('click', saveToStorage);
  if (loadChainBtn) loadChainBtn.addEventListener('click', () => {
    loadFromStorage();
    renderChain();
    appendLog('Loaded chain from storage');
  });

  // export JSON
  if (exportJSONBtn){
    exportJSONBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(chain, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qssi-chain.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      appendLog('Exported chain JSON');
    });
  }

  if (copyChainBtn){
    copyChainBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(chain, null, 2));
        appendLog('Chain JSON copied to clipboard');
      } catch (e) {
        appendLog('Copy failed');
      }
    });
  }

  // export PNG (SVG -> Canvas)
  if (exportPNGBtn){
    exportPNGBtn.addEventListener('click', async () => {
      if (!chainSvg) return;
      try {
        const svgData = new XMLSerializer().serializeToString(chainSvg);
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // scale: keep original svg size (900x260) or use bounding box
          const w = 900, h = 260;
          canvas.width = w*2; // high res
          canvas.height = h*2;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000';
          ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          const png = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = png;
          a.download = 'qssi-chain.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          appendLog('Exported PNG');
        };
        img.onerror = () => {
          appendLog('SVG -> PNG conversion failed');
        };
        img.src = url;
      } catch (e) {
        appendLog('Export failed');
      }
    });
  }

  // generate and copy webhook payloads
  if (genPayloadBtn){
    genPayloadBtn.addEventListener('click', () => {
      // build sample payload from selected node and chain context
      if (selectedIndex === null) {
        appendLog('Select a node to generate payload');
        return;
      }
      const source = chain[selectedIndex].id || chain[selectedIndex].label;
      const target = (selectedIndex < chain.length -1) ? (chain[selectedIndex +1].id || chain[selectedIndex+1].label) : 'sink';
      const payload = {
        source_link: source,
        target_link: target,
        event: "pass_through",
        subject_id: `subject-${Math.floor(Math.random()*9000)+1000}`,
        timestamp: (new Date()).toISOString(),
        context: {
          node_label: chain[selectedIndex].label,
          confidence: 0.9
        }
      };
      if (payloadTextarea) payloadTextarea.value = JSON.stringify(payload, null, 2);
      appendLog('Generated webhook payload');
    });
  }

  if (copyPayloadBtn){
    copyPayloadBtn.addEventListener('click', async () => {
      if (!payloadTextarea) return;
      try {
        await navigator.clipboard.writeText(payloadTextarea.value);
        appendLog('Payload copied to clipboard');
      } catch (e) {
        appendLog('Copy payload failed');
      }
    });
  }

  if (downloadPayloadBtn){
    downloadPayloadBtn.addEventListener('click', () => {
      if (!payloadTextarea) return;
      const blob = new Blob([payloadTextarea.value], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payload.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      appendLog('Downloaded payload JSON');
    });
  }

  // step / reset / alert behavior (visual)
  if (chainSvg && stepBtn && resetBtn && alertBtn){
    let playIndex = 0;
    const nodesSelector = () => Array.from(chainSvg.querySelectorAll('.node'));
    const connsSelector = () => Array.from(chainSvg.querySelectorAll('.conn-line'));

    const resetVisual = () => {
      const nodes = nodesSelector();
      nodes.forEach((n, i) => {
        const c = n.querySelector('circle');
        c.setAttribute('fill', '#0f0f10');
        c.setAttribute('stroke', '#ff3b3b');
      });
      const conns = connsSelector();
      conns.forEach(c => c.setAttribute('stroke', '#444'));
      playIndex = 0;
      appendLog('Simulation reset');
    };

    stepBtn.addEventListener('click', () => {
      const nodes = nodesSelector();
      const conns = connsSelector();
      if (playIndex >= nodes.length) {
        appendLog('Chain complete');
        return;
      }
      const n = nodes[playIndex];
      const circle = n.querySelector('circle');
      circle.setAttribute('fill', '#ff3b3b');
      circle.setAttribute('stroke', '#fff');
      if (playIndex > 0 && conns[playIndex-1]) conns[playIndex-1].setAttribute('stroke', '#ff3b3b');
      appendLog(`Activated: ${chain[playIndex].label}`);
      playIndex++;
    });

    resetBtn.addEventListener('click', resetVisual);

    alertBtn.addEventListener('click', () => {
      // random node alert
      const nodes = nodesSelector();
      if (nodes.length === 0) return;
      const idx = Math.floor(Math.random() * nodes.length);
      const circle = nodes[idx].querySelector('circle');
      const orig = circle.getAttribute('fill');
      circle.setAttribute('fill', '#fff');
      setTimeout(()=> circle.setAttribute('fill', '#ff3b3b'), 260);
      // harden neighbors
      const conns = connsSelector();
      if (idx>0 && conns[idx-1]) conns[idx-1].setAttribute('stroke','#fff');
      if (idx < conns.length && conns[idx]) conns[idx].setAttribute('stroke','#fff');
      appendLog(`ALERT at ${chain[idx].label} — neighbors hardening`);
    });

    // clicking node triggers activation for that node index
    chainSvg.addEventListener('click', (e) => {
      const g = e.target.closest('.node');
      if (!g) return;
      const idx = Number(g.dataset.index);
      // set playIndex such that clicking activates that node
      playIndex = idx;
      // simulate step
      stepBtn.click();
    });

    // initial reset
    resetVisual();
  }

  /* ---------------- Documentation JSON Editor (if present) ---------------- */
  const payloadEditorArea = document.getElementById('payloadTextarea');
  if (payloadEditorArea && chain.length>0) {
    // populate with empty template
    payloadEditorArea.value = JSON.stringify({
      source_link: chain[0].id || chain[0].label,
      target_link: (chain[1] ? (chain[1].id || chain[1].label) : 'sink'),
      event: 'pass_through',
      subject_id: 'subject-0001',
      timestamp: (new Date()).toISOString(),
      context: { confidence: 0.9 }
    }, null, 2);
  }

});
