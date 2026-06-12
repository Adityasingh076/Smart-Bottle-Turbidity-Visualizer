 const readings = [];
    const cleanColor = [0, 191, 255];
    const dirtyColor = [112, 93, 58];

    function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
    function lerpColor(c1, c2, t) {
      return `rgb(${lerp(c1[0],c2[0],t)}, ${lerp(c1[1],c2[1],t)}, ${lerp(c1[2],c2[2],t)})`;
    }

    function getCategory(ntu) {
      if (ntu <= 5)  return { label: 'Excellent',        cls: 'badge-excellent' };
      if (ntu <= 25) return { label: 'Safe',             cls: 'badge-safe' };
      if (ntu <= 50) return { label: 'Slightly Cloudy',  cls: 'badge-cloudy' };
      if (ntu <= 75) return { label: 'Not Recommended',  cls: 'badge-notrec' };
      return           { label: 'Contaminated',      cls: 'badge-contaminated' };
    }

    // Chart setup
    const ctx = document.getElementById('ntuChart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'NTU',
          data: [],
          borderColor: '#185FA5',
          borderWidth: 2,
          fill: true,
          backgroundColor: 'rgba(24, 95, 165, 0.08)',
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#185FA5'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            min: 0, max: 100,
            grid: { color: 'rgba(128,128,128,0.1)' },
            ticks: { font: { size: 11 }, color: '#888' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#888' }
          }
        }
      }
    });

    function updateUI(ntu) {
      const t = Math.min(1, Math.max(0, ntu / 100));
      const col = lerpColor(cleanColor, dirtyColor, t);

      document.getElementById('bottleFill').style.backgroundColor = col;
      document.getElementById('bottleBody').style.backgroundColor = col;
      document.getElementById('ntuBig').textContent = ntu;
      document.getElementById('gaugeMarker').style.left = ntu + '%';

      const cat = getCategory(ntu);
      const badge = document.getElementById('statusBadge');
      badge.textContent = cat.label;
      badge.className = 'status-badge ' + cat.cls;

      readings.push({ time: new Date(), ntu });

      const labels = readings.map(r => r.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const values = readings.map(r => r.ntu);
      chart.data.labels = labels.slice(-20);
      chart.data.datasets[0].data = values.slice(-20);
      chart.update();

      updateMetrics();
      updateLog();
    }

    function updateMetrics() {
      const vals = readings.map(r => r.ntu);
      document.getElementById('mCount').textContent = vals.length;
      document.getElementById('mAvg').textContent = vals.length
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : '--';
      document.getElementById('mMax').textContent = vals.length
        ? Math.max(...vals) : '--';
    }

    function updateLog() {
      const tbody = document.getElementById('logBody');
      tbody.innerHTML = '';
      const rev = [...readings].reverse().slice(0, 30);
      rev.forEach((r, i) => {
        const cat = getCategory(r.ntu);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="log-index">${readings.length - i}</td>
          <td>${r.time.toLocaleTimeString()}</td>
          <td class="log-ntu">${r.ntu}</td>
          <td><span class="${cat.cls} log-badge">${cat.label}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }

    function exportCSV() {
      if (!readings.length) { alert('No readings to export yet.'); return; }
      const rows = [
        ['#', 'Timestamp', 'NTU', 'Status'],
        ...readings.map((r, i) => [i + 1, r.time.toISOString(), r.ntu, getCategory(r.ntu).label])
      ];
      const csv = rows.map(r => r.join(',')).join('\n');
      const a = document.createElement('a');
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
      a.download = 'turbidity_readings.csv';
      a.click();
    }

    // Image analysis
    document.getElementById('imageUpload').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 150;
          const x = canvas.getContext('2d');
          x.drawImage(img, (img.width - 150) / 2, (img.height - 150) / 2, 150, 150, 0, 0, 150, 150);
          const data = x.getImageData(0, 0, 150, 150).data;

          let rSum = 0, gSum = 0, bSum = 0;
          const n = data.length / 4;
          for (let i = 0; i < data.length; i += 4) {
            rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
          }
          const avgR = rSum / n, avgG = gSum / n, avgB = bSum / n;
          const brightness = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
          const colorfulness = Math.sqrt(
            Math.pow(avgR - avgG, 2) + Math.pow(avgG - avgB, 2) + Math.pow(avgB - avgR, 2)
          );
          // Improved NTU formula: lower brightness + higher colorfulness = higher turbidity
          const rawNTU = 110 - (brightness / 255) * 90 + (colorfulness / 100) * 15;
          const finalNTU = Math.max(0, Math.min(100, Math.round(rawNTU)));
          updateUI(finalNTU);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });