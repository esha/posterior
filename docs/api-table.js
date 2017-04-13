(function(D, Posterior, JSON, Case) {

    function toTable(data) {
        var table = D.createElement('table'),
            cols = Object.keys(data.head);
        table.setAttribute('cellspacing', 0);
        table.insert('thead>tr>th*'+cols.length)
             .each(function(th, i) {
                 var prop = cols[i];
                 th.classList.add(prop);
                 th.textContent = data.head[prop];
             });

        var tbody = table.insert('tbody');
        data.body.forEach(function(row, i) {
            if (row.subHeader) {
                tbody.appendChild(toSubHeader(cols, row));
            } else {
                tbody.appendChild(toRow(cols, row, i));
            }
        });
        return table;
    }

    function toTR(id, i) {
        var tr = D.createElement('tr');
        if (id) {
            id = Case.kebab(id);
            tr.id = D.query(id) ? id+i : id;// try to keep ids unique
        }
        return tr;
    }

    function toSubHeader(cols, row, i) {
        var tr = toTR(row.subHeader, i),
            th = tr.insert('th');
        tr.classList.add('sub-header');
        th.setAttribute('colspan', cols.length);
        th.textContent = row.subHeader;
        return tr;
    }

    function toRow(cols, row, i) {
        var tr = toTR(row[cols[0]], i);
        tr.insert('td*'+cols.length)
          .each(function(td, i) {
            var prop = cols[i],
                content = prop in row ? row[prop] : '';
            if (typeof content === "object") {
                content = JSON.stringify(content, null, 2);
            }
            td.classList.add(prop);
            if (i === 0) {
                content = '<a name="'+tr.id+'"></a>' + content;
            }
            if (typeof content === "string" && isMultiline(content)) {
                content = '<div class="multiline">'+content+'</div>';
            }
            td.innerHTML = content;
          });
        return tr;
    }

    function isMultiline(string) {
        return string.indexOf("\n") >= 0 || string.length > 50;
    }

    D.queryAll('[api-table]').each(function(el) {
       var url = el.getAttribute('api-table');
        Posterior(url, function(data) {
            el.appendChild(toTable(data));
        })().catch(function(e) {
            console.error(url, e);
        });
    });

})(document, Posterior, JSON, Case)
