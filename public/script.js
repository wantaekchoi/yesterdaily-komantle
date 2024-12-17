const Model = {
  results: [],
  recent: {},
  lastSort: { column: "sim", direction: "desc" },

  loadFromStorage() {
    const savedResults = localStorage.getItem("results");
    if (savedResults) {
      this.results = JSON.parse(savedResults);
    }
    const savedSort = localStorage.getItem("lastSort");
    if (savedSort) {
      this.savedSort = JSON.parse(savedSort);
    }
  },

  saveToStorage() {
    localStorage.setItem("results", JSON.stringify(this.results));
    localStorage.setItem("lastSort", JSON.stringify(this.results));
  },

  addResult(result) {
    this.results.push(result);
    this.recent = result;
    this.saveToStorage();
  },

  updateResult(index, updatedResult) {
    this.results[index] = updatedResult;
    this.recent = updatedResult;
    this.saveToStorage();
  },

  findResult(word, date) {
    return this.results.findIndex(
      (entry) => entry.word === word && entry.date === date
    );
  },
};

const View = {
  init() {
    this.guessInput = document.getElementById("guessInput");
    this.dateInput = document.getElementById("dateInput");
    this.recentEntryDiv = document.getElementById("recentEntry");
    this.resultTablesDiv = document.getElementById("resultTables");
    this.submitButton = document.getElementById("submitButton");
    this.resetButton = document.getElementById("resetResults");

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const maxDate = `${yyyy}-${mm}-${dd}`;

    this.dateInput.max = maxDate;
    this.dateInput.value = maxDate;
  },

  renderRecent(recent) {
    if (!recent || !recent.sim) {
      this.recentEntryDiv.innerHTML = "";
      return;
    }

    this.recentEntryDiv.innerHTML = `
      <strong>가장 최근 입력:</strong>
      <p>
        <strong>단어:</strong> ${recent.word} |
        <strong>유사도:</strong> ${recent.sim.toFixed(4)} |
        <strong>순위:</strong> ${recent.rank || "없음"}
      </p>`;
  },

  renderTables(groupedResults) {
    this.resultTablesDiv.innerHTML = "";

    for (const [date, items] of Object.entries(groupedResults)) {
      const { column, direction } = Model.lastSort;

      items.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (direction === "asc") {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });

      const dateHeader = document.createElement("h3");
      this.resultTablesDiv.appendChild(dateHeader);

      const table = document.createElement("table");
      table.innerHTML = `
        <thead>
          <tr>
            <th class="button" onclick="ViewModel.handleSort('${date}', 'user_index')">#</th>
            <th>단어</th>
            <th class="button" onclick="ViewModel.handleSort('${date}', 'sim')">유사도</th>
          </tr>
        </thead>`;

      const tbody = document.createElement("tbody");
      items.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.user_index}</td>
          <td>${item.word}</td>
          <td>
            <div>
              ${item.rank} (${item.sim.toFixed(4)})
            </div>
            <progress id="sim-bar" min="0.0" max="1.0" value=${item.sim} /> 
          </td>`;
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      this.resultTablesDiv.appendChild(table);
    }
  },
};

const ViewModel = {
  selectedDate: "",

  init() {
    Model.loadFromStorage();
    View.init();

    this.selectedDate = View.dateInput.value;

    assignUserIndex();
    this.updateView();

    View.submitButton.addEventListener("click", () => this.handleSubmit());
    View.resetButton.addEventListener("click", () => this.handleReset());
    View.dateInput.addEventListener("change", (event) =>
      this.handleDateChange(event)
    );
    View.guessInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        this.handleSubmit();
      }
    });
  },

  handleDateChange(event) {
    this.selectedDate = event.target.value;
    this.updateView();
  },

  handleSubmit() {
    const inputWord = View.guessInput.value.trim();
    const inputDate = View.dateInput.value;

    if (!inputWord) {
      alert("단어를 입력해주세요!");
      return;
    }

    if (!inputDate) {
      alert("날짜를 선택해주세요!");
      return;
    }

    const existingIndex = Model.findResult(inputWord, inputDate);
    if (existingIndex !== -1) {
      const updatedResult = {
        ...Model.results[existingIndex],
        timestamp: Date.now(),
      };
      Model.updateResult(existingIndex, updatedResult);

      assignUserIndex();
      this.updateView();

      View.guessInput.value = "";
      return;
    }

    fetch(`/api/guess/${inputWord}?date=${inputDate}`)
      .then((response) => {
        if (!response.ok) throw new Error("API 요청 실패");
        return response.json();
      })
      .then((data) => {
        const newResult = {
          word: inputWord,
          sim: parseFloat(data.sim),
          rank: data.rank || "없음",
          date: inputDate,
          timestamp: Date.now(),
        };

        Model.addResult(newResult);

        assignUserIndex();
        this.updateView();
        View.guessInput.value = "";
      })
      .catch(console.error);
  },

  handleReset() {
    if (confirm("결과를 모두 삭제하시겠습니까?")) {
      Model.results = [];
      Model.saveToStorage();

      assignUserIndex();
      this.updateView();
    }
  },

  handleSort(date, column) {
    const currentSortDirection =
      Model.lastSort.column === column && Model.lastSort.direction === "asc"
        ? "desc"
        : "asc";

    const groupedResults = groupResultsByDate();
    const items = groupedResults[date] || [];

    items.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (currentSortDirection === "asc") {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });

    Model.lastSort = { column, direction: currentSortDirection };
    Model.saveToStorage();

    View.renderTables({ [date]: items }, Model.lastSort);
  },

  updateView() {
    const groupedResults = groupResultsByDate();
    const filteredResults = {
      [this.selectedDate]: groupedResults[this.selectedDate] || [],
    };

    View.renderRecent(Model.recent);
    View.renderTables(filteredResults);
  },
};

function groupResultsByDate() {
  return Model.results.reduce((acc, result) => {
    if (!acc[result.date]) acc[result.date] = [];
    acc[result.date].push(result);
    return acc;
  }, {});
}

function assignUserIndex() {
  const groupedResults = groupResultsByDate();

  for (const [date, items] of Object.entries(groupedResults)) {
    items.sort((a, b) => a.timestamp - b.timestamp);

    items.forEach((item, index) => (item.user_index = index + 1));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  ViewModel.init();
});
