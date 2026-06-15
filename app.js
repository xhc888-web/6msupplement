(function () {
  "use strict";

  const STORAGE_KEY = "supplyChainProgressDashboard.v1";
  const STAGES = ["报价中", "打样中", "样品确认", "生产中", "验货中", "已出货", "已完成", "暂停"];
  const RISKS = ["正常", "关注", "高风险", "已逾期"];
  const ACTION_TYPES = ["报价", "打样", "修改", "确认", "生产", "验货", "发货", "付款", "其他"];
  const TIMELINE_STATUSES = ["待处理", "进行中", "已完成", "暂停"];

  const state = {
    products: [],
    selectedProductId: null
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    populateStaticSelects();
    bindEvents();
    loadData();
    render();
  }

  function cacheElements() {
    Object.assign(els, {
      addProductBtn: document.getElementById("addProductBtn"),
      importBtn: document.getElementById("importBtn"),
      exportBtn: document.getElementById("exportBtn"),
      clearAllBtn: document.getElementById("clearAllBtn"),
      importFileInput: document.getElementById("importFileInput"),
      productGrid: document.getElementById("productGrid"),
      emptyState: document.getElementById("emptyState"),
      resultCount: document.getElementById("resultCount"),
      statTotal: document.getElementById("statTotal"),
      statActive: document.getElementById("statActive"),
      statNearDue: document.getElementById("statNearDue"),
      statHighRisk: document.getElementById("statHighRisk"),
      statOverdue: document.getElementById("statOverdue"),
      searchName: document.getElementById("searchName"),
      searchSku: document.getElementById("searchSku"),
      searchFactory: document.getElementById("searchFactory"),
      filterStage: document.getElementById("filterStage"),
      filterRisk: document.getElementById("filterRisk"),
      sortDue: document.getElementById("sortDue"),
      resetFiltersBtn: document.getElementById("resetFiltersBtn"),
      productModal: document.getElementById("productModal"),
      productModalTitle: document.getElementById("productModalTitle"),
      closeProductModalBtn: document.getElementById("closeProductModalBtn"),
      cancelProductBtn: document.getElementById("cancelProductBtn"),
      productForm: document.getElementById("productForm"),
      productId: document.getElementById("productId"),
      productName: document.getElementById("productName"),
      productSku: document.getElementById("productSku"),
      factoryName: document.getElementById("factoryName"),
      factoryContact: document.getElementById("factoryContact"),
      owner: document.getElementById("owner"),
      productImage: document.getElementById("productImage"),
      imageData: document.getElementById("imageData"),
      imagePreview: document.getElementById("imagePreview"),
      removeImageBtn: document.getElementById("removeImageBtn"),
      startDate: document.getElementById("startDate"),
      dueDate: document.getElementById("dueDate"),
      stage: document.getElementById("stage"),
      risk: document.getElementById("risk"),
      notes: document.getElementById("notes"),
      detailModal: document.getElementById("detailModal"),
      closeDetailModalBtn: document.getElementById("closeDetailModalBtn"),
      detailTitle: document.getElementById("detailTitle"),
      detailBody: document.getElementById("detailBody"),
      timelineFormTemplate: document.getElementById("timelineFormTemplate")
    });
  }

  function populateStaticSelects() {
    fillSelect(els.filterStage, STAGES, "全部阶段");
    fillSelect(els.filterRisk, RISKS, "全部风险");
    fillSelect(els.stage, STAGES);
    fillSelect(els.risk, RISKS);
  }

  function fillSelect(select, options, firstLabel) {
    select.innerHTML = "";
    if (firstLabel) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = firstLabel;
      select.appendChild(option);
    }
    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      select.appendChild(option);
    });
  }

  function bindEvents() {
    els.addProductBtn.addEventListener("click", openCreateProductModal);
    els.closeProductModalBtn.addEventListener("click", closeProductModal);
    els.cancelProductBtn.addEventListener("click", closeProductModal);
    els.closeDetailModalBtn.addEventListener("click", closeDetailModal);
    els.productForm.addEventListener("submit", handleProductSubmit);
    els.productImage.addEventListener("change", handleImageUpload);
    els.removeImageBtn.addEventListener("click", clearImage);
    els.exportBtn.addEventListener("click", exportData);
    els.importBtn.addEventListener("click", () => els.importFileInput.click());
    els.importFileInput.addEventListener("change", handleImportFile);
    els.clearAllBtn.addEventListener("click", clearAllData);
    els.resetFiltersBtn.addEventListener("click", resetFilters);

    [els.searchName, els.searchSku, els.searchFactory, els.filterStage, els.filterRisk, els.sortDue].forEach((control) => {
      control.addEventListener("input", renderProductList);
      control.addEventListener("change", renderProductList);
    });

    els.productGrid.addEventListener("click", handleProductGridClick);
    els.productModal.addEventListener("click", closeModalOnBackdrop);
    els.detailModal.addEventListener("click", closeModalOnBackdrop);
    document.addEventListener("keydown", handleEscape);
  }

  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.products = getDefaultProducts();
      saveData();
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const checked = validateImportData(parsed);
      if (!checked.valid) {
        throw new Error(checked.message);
      }
      state.products = checked.products;
    } catch (error) {
      console.warn("本地数据损坏，已恢复默认示例数据：", error);
      state.products = getDefaultProducts();
      saveData();
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      products: state.products
    }));
  }

  function render() {
    renderStats();
    renderProductList();
  }

  function renderStats() {
    const stats = state.products.reduce((acc, product) => {
      const due = getDueStatus(product);
      acc.total += 1;
      if (!["已完成", "暂停"].includes(product.stage)) acc.active += 1;
      if (due.type === "near") acc.nearDue += 1;
      if (product.risk === "高风险") acc.highRisk += 1;
      if (due.type === "overdue" || product.risk === "已逾期") acc.overdue += 1;
      return acc;
    }, { total: 0, active: 0, nearDue: 0, highRisk: 0, overdue: 0 });

    els.statTotal.textContent = stats.total;
    els.statActive.textContent = stats.active;
    els.statNearDue.textContent = stats.nearDue;
    els.statHighRisk.textContent = stats.highRisk;
    els.statOverdue.textContent = stats.overdue;
  }

  function renderProductList() {
    const products = getFilteredProducts();
    els.resultCount.textContent = `共 ${products.length} 个产品`;
    els.productGrid.innerHTML = "";
    els.emptyState.classList.toggle("hidden", products.length > 0);

    products.forEach((product) => {
      els.productGrid.appendChild(createProductCard(product));
    });

    renderStats();
  }

  function getFilteredProducts() {
    const name = normalize(els.searchName.value);
    const sku = normalize(els.searchSku.value);
    const factory = normalize(els.searchFactory.value);
    const stage = els.filterStage.value;
    const risk = els.filterRisk.value;
    const sort = els.sortDue.value;

    const filtered = state.products.filter((product) => {
      return (!name || normalize(product.name).includes(name))
        && (!sku || normalize(product.sku).includes(sku))
        && (!factory || normalize(product.factoryName).includes(factory))
        && (!stage || product.stage === stage)
        && (!risk || product.risk === risk);
    });

    if (sort !== "none") {
      filtered.sort((a, b) => {
        const aTime = toDate(a.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bTime = toDate(b.dueDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        return sort === "asc" ? aTime - bTime : bTime - aTime;
      });
    }

    return filtered;
  }

  function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";
    const due = getDueStatus(product);
    const latest = getLatestTimeline(product);

    card.innerHTML = `
      <div class="product-image">
        ${product.image ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name)}">` : `<div class="product-placeholder">产品图片</div>`}
        <span class="tag ${due.className} due-badge">${escapeHtml(due.label)}</span>
      </div>
      <div class="card-body">
        <div class="card-title-row">
          <div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="sku">SKU：${escapeHtml(product.sku)}</p>
          </div>
          <span class="tag ${getRiskClass(product.risk)}">${escapeHtml(product.risk)}</span>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><span>工厂</span><strong>${escapeHtml(product.factoryName)}</strong></div>
          <div class="meta-item"><span>当前阶段</span><strong><span class="tag tag-stage">${escapeHtml(product.stage)}</span></strong></div>
          <div class="meta-item"><span>预计交期</span><strong>${formatDate(product.dueDate)}</strong></div>
          <div class="meta-item"><span>距离交期</span><strong>${escapeHtml(due.daysLabel)}</strong></div>
        </div>
        <div class="latest-record">
          <span>最近操作记录</span>
          <p>${latest ? escapeHtml(latest.content) : "暂无时间线记录"}</p>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn btn-primary" type="button" data-action="view" data-id="${product.id}">查看详情</button>
        <button class="btn" type="button" data-action="edit" data-id="${product.id}">编辑</button>
        <button class="btn btn-danger-soft" type="button" data-action="delete" data-id="${product.id}">删除</button>
      </div>
    `;

    return card;
  }

  function handleProductGridClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const product = findProduct(button.dataset.id);
    if (!product) return;

    if (button.dataset.action === "view") openDetailModal(product.id);
    if (button.dataset.action === "edit") openEditProductModal(product.id);
    if (button.dataset.action === "delete") deleteProduct(product.id);
  }

  function openCreateProductModal() {
    els.productModalTitle.textContent = "新增产品";
    els.productForm.reset();
    els.productId.value = "";
    els.stage.value = "报价中";
    els.risk.value = "正常";
    els.startDate.value = toDateInput(new Date());
    els.dueDate.value = "";
    clearImage();
    openModal(els.productModal);
    els.productName.focus();
  }

  function openEditProductModal(id) {
    const product = findProduct(id);
    if (!product) return;
    els.productModalTitle.textContent = "编辑产品";
    els.productId.value = product.id;
    els.productName.value = product.name;
    els.productSku.value = product.sku;
    els.factoryName.value = product.factoryName;
    els.factoryContact.value = product.factoryContact || "";
    els.owner.value = product.owner;
    els.imageData.value = product.image || "";
    els.startDate.value = product.startDate;
    els.dueDate.value = product.dueDate;
    els.stage.value = product.stage;
    els.risk.value = product.risk;
    els.notes.value = product.notes || "";
    renderImagePreview(product.image);
    openModal(els.productModal);
    els.productName.focus();
  }

  function closeProductModal() {
    closeModal(els.productModal);
  }

  function handleProductSubmit(event) {
    event.preventDefault();
    if (!els.productForm.reportValidity()) return;

    const payload = {
      name: trimValue(els.productName),
      sku: trimValue(els.productSku),
      factoryName: trimValue(els.factoryName),
      factoryContact: trimValue(els.factoryContact),
      owner: trimValue(els.owner),
      image: els.imageData.value || "",
      startDate: els.startDate.value,
      dueDate: els.dueDate.value,
      stage: els.stage.value,
      risk: els.risk.value,
      notes: trimValue(els.notes)
    };

    if (toDate(payload.dueDate) < toDate(payload.startDate)) {
      alert("预计交期不能早于项目开始日期。");
      return;
    }

    const id = els.productId.value;
    if (id) {
      const index = state.products.findIndex((item) => item.id === id);
      if (index !== -1) {
        state.products[index] = {
          ...state.products[index],
          ...payload,
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      state.products.unshift({
        id: createId("product"),
        ...payload,
        timeline: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    saveData();
    render();
    closeProductModal();
  }

  function deleteProduct(id) {
    const product = findProduct(id);
    if (!product) return;
    const ok = confirm(`确认删除产品「${product.name}」吗？此操作不可恢复。`);
    if (!ok) return;
    state.products = state.products.filter((item) => item.id !== id);
    saveData();
    render();
  }

  function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("请选择图片文件。");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("图片建议控制在 2MB 以内。");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      els.imageData.value = reader.result;
      renderImagePreview(reader.result);
    };
    reader.onerror = () => alert("图片读取失败，请重试。");
    reader.readAsDataURL(file);
  }

  function renderImagePreview(src) {
    if (!src) {
      els.imagePreview.textContent = "无图片";
      return;
    }
    els.imagePreview.innerHTML = `<img src="${escapeAttr(src)}" alt="产品图片预览">`;
  }

  function clearImage() {
    els.productImage.value = "";
    els.imageData.value = "";
    renderImagePreview("");
  }

  function openDetailModal(id) {
    const product = findProduct(id);
    if (!product) return;
    state.selectedProductId = id;
    els.detailTitle.textContent = product.name;
    renderDetail(product);
    openModal(els.detailModal);
  }

  function closeDetailModal() {
    closeModal(els.detailModal);
    state.selectedProductId = null;
  }

  function renderDetail(product) {
    const due = getDueStatus(product);
    els.detailBody.innerHTML = `
      <div class="detail-layout">
        <aside class="detail-side">
          <div class="detail-side-image">
            ${product.image ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name)}">` : `<div class="product-placeholder">产品图片</div>`}
          </div>
          <div class="detail-info">
            <div class="card-title-row">
              <div>
                <h3>${escapeHtml(product.name)}</h3>
                <p class="sku">SKU：${escapeHtml(product.sku)}</p>
              </div>
              <span class="tag ${due.className}">${escapeHtml(due.label)}</span>
            </div>
            <dl>
              <dt>工厂名称</dt><dd>${escapeHtml(product.factoryName)}</dd>
              <dt>工厂联系人</dt><dd>${escapeHtml(product.factoryContact || "-")}</dd>
              <dt>内部负责人</dt><dd>${escapeHtml(product.owner)}</dd>
              <dt>开始日期</dt><dd>${formatDate(product.startDate)}</dd>
              <dt>预计交期</dt><dd>${formatDate(product.dueDate)}（${escapeHtml(due.daysLabel)}）</dd>
              <dt>当前阶段</dt><dd><span class="tag tag-stage">${escapeHtml(product.stage)}</span></dd>
              <dt>风险等级</dt><dd><span class="tag ${getRiskClass(product.risk)}">${escapeHtml(product.risk)}</span></dd>
              <dt>备注</dt><dd>${escapeHtml(product.notes || "-")}</dd>
            </dl>
          </div>
        </aside>
        <section class="detail-main">
          <div id="timelineFormMount"></div>
          <div class="timeline-panel">
            <h3>时间线记录</h3>
            <div class="timeline-list" id="timelineList"></div>
          </div>
        </section>
      </div>
    `;

    mountTimelineForm();
    renderTimelineList(product);
  }

  function mountTimelineForm() {
    const mount = document.getElementById("timelineFormMount");
    const fragment = els.timelineFormTemplate.content.cloneNode(true);
    mount.appendChild(fragment);

    fillSelect(document.getElementById("actionType"), ACTION_TYPES);
    fillSelect(document.getElementById("timelineStatus"), TIMELINE_STATUSES);
    document.getElementById("recordTime").value = toDateTimeInput(new Date());
    document.getElementById("timelineForm").addEventListener("submit", handleTimelineSubmit);
  }

  function renderTimelineList(product) {
    const list = document.getElementById("timelineList");
    const timeline = [...(product.timeline || [])].sort((a, b) => {
      return new Date(b.recordTime).getTime() - new Date(a.recordTime).getTime();
    });

    if (timeline.length === 0) {
      list.innerHTML = `<div class="empty-state"><div><h3>暂无时间线记录</h3><p>添加第一条操作记录后，将在这里倒序展示。</p></div></div>`;
      return;
    }

    list.innerHTML = timeline.map((item) => `
      <article class="timeline-item">
        <div class="timeline-head">
          <div>
            <h4>${escapeHtml(item.actionType)} · <span class="tag ${getTimelineStatusClass(item.status)}">${escapeHtml(item.status)}</span></h4>
            <div class="timeline-time">${formatDateTime(item.recordTime)}</div>
          </div>
          <button class="link-danger" type="button" data-timeline-delete="${escapeAttr(item.id)}">删除</button>
        </div>
        <div class="timeline-content">${escapeHtml(item.content)}</div>
        <div class="timeline-extra">
          <div><strong>下一步动作：</strong>${escapeHtml(item.nextAction || "-")}</div>
          <div><strong>下一步截止时间：</strong>${item.nextDeadline ? formatDate(item.nextDeadline) : "-"}</div>
          <div><strong>备注：</strong>${escapeHtml(item.notes || "-")}</div>
        </div>
      </article>
    `).join("");

    list.querySelectorAll("[data-timeline-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteTimelineItem(button.dataset.timelineDelete));
    });
  }

  function handleTimelineSubmit(event) {
    event.preventDefault();
    const product = findProduct(state.selectedProductId);
    if (!product) return;

    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const item = {
      id: createId("timeline"),
      recordTime: document.getElementById("recordTime").value,
      actionType: document.getElementById("actionType").value,
      content: trimValue(document.getElementById("recordContent")),
      nextAction: trimValue(document.getElementById("nextAction")),
      nextDeadline: document.getElementById("nextDeadline").value,
      status: document.getElementById("timelineStatus").value,
      notes: trimValue(document.getElementById("timelineNotes")),
      createdAt: new Date().toISOString()
    };

    product.timeline = Array.isArray(product.timeline) ? product.timeline : [];
    product.timeline.push(item);
    product.updatedAt = new Date().toISOString();
    saveData();
    render();
    renderDetail(product);
  }

  function deleteTimelineItem(timelineId) {
    const product = findProduct(state.selectedProductId);
    if (!product) return;
    const ok = confirm("确认删除这条时间线记录吗？");
    if (!ok) return;
    product.timeline = (product.timeline || []).filter((item) => item.id !== timelineId);
    product.updatedAt = new Date().toISOString();
    saveData();
    render();
    renderDetail(product);
  }

  function exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      products: state.products
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `supply-chain-data-${toDateInput(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const checked = validateImportData(parsed);
        if (!checked.valid) {
          alert(`导入失败：${checked.message}`);
          return;
        }
        const ok = confirm(`确认导入 ${checked.products.length} 个产品吗？当前数据将被覆盖。`);
        if (!ok) return;
        state.products = checked.products;
        saveData();
        render();
        closeDetailModal();
        closeProductModal();
        alert("导入成功。");
      } catch (error) {
        alert("导入失败：JSON 文件无法解析。");
      } finally {
        els.importFileInput.value = "";
      }
    };
    reader.onerror = () => {
      alert("文件读取失败，请重试。");
      els.importFileInput.value = "";
    };
    reader.readAsText(file, "utf-8");
  }

  function validateImportData(input) {
    const products = Array.isArray(input) ? input : input && input.products;
    if (!Array.isArray(products)) {
      return { valid: false, message: "文件中必须包含 products 数组，或直接是产品数组。" };
    }
    if (products.length > 1000) {
      return { valid: false, message: "一次最多导入 1000 个产品。" };
    }

    const cleaned = [];
    for (let index = 0; index < products.length; index += 1) {
      const product = products[index];
      if (!isPlainObject(product)) {
        return { valid: false, message: `第 ${index + 1} 个产品格式不正确。` };
      }
      const required = ["name", "sku", "factoryName", "owner", "startDate", "dueDate", "stage", "risk"];
      for (const key of required) {
        if (!String(product[key] || "").trim()) {
          return { valid: false, message: `第 ${index + 1} 个产品缺少字段：${key}。` };
        }
      }
      if (!STAGES.includes(product.stage)) {
        return { valid: false, message: `第 ${index + 1} 个产品的当前阶段无效。` };
      }
      if (!RISKS.includes(product.risk)) {
        return { valid: false, message: `第 ${index + 1} 个产品的风险等级无效。` };
      }
      if (!isValidDateString(product.startDate) || !isValidDateString(product.dueDate)) {
        return { valid: false, message: `第 ${index + 1} 个产品的日期格式无效。` };
      }

      const timeline = Array.isArray(product.timeline) ? product.timeline : [];
      const cleanedTimeline = [];
      for (let tIndex = 0; tIndex < timeline.length; tIndex += 1) {
        const item = timeline[tIndex];
        if (!isPlainObject(item)) {
          return { valid: false, message: `第 ${index + 1} 个产品的第 ${tIndex + 1} 条时间线格式不正确。` };
        }
        if (!item.recordTime || !item.actionType || !item.content || !item.status) {
          return { valid: false, message: `第 ${index + 1} 个产品的第 ${tIndex + 1} 条时间线缺少必填字段。` };
        }
        if (!ACTION_TYPES.includes(item.actionType)) {
          return { valid: false, message: `第 ${index + 1} 个产品的第 ${tIndex + 1} 条时间线操作类型无效。` };
        }
        if (!TIMELINE_STATUSES.includes(item.status)) {
          return { valid: false, message: `第 ${index + 1} 个产品的第 ${tIndex + 1} 条时间线状态无效。` };
        }
        cleanedTimeline.push({
          id: String(item.id || createId("timeline")),
          recordTime: String(item.recordTime),
          actionType: String(item.actionType),
          content: String(item.content).slice(0, 500),
          nextAction: String(item.nextAction || "").slice(0, 300),
          nextDeadline: isValidDateString(item.nextDeadline) ? item.nextDeadline : "",
          status: String(item.status),
          notes: String(item.notes || "").slice(0, 300),
          createdAt: String(item.createdAt || new Date().toISOString())
        });
      }

      cleaned.push({
        id: String(product.id || createId("product")),
        name: String(product.name).trim().slice(0, 80),
        sku: String(product.sku).trim().slice(0, 60),
        factoryName: String(product.factoryName).trim().slice(0, 80),
        factoryContact: String(product.factoryContact || "").trim().slice(0, 80),
        owner: String(product.owner).trim().slice(0, 60),
        image: isSafeImageData(product.image) ? product.image : "",
        startDate: product.startDate,
        dueDate: product.dueDate,
        stage: product.stage,
        risk: product.risk,
        notes: String(product.notes || "").slice(0, 500),
        timeline: cleanedTimeline,
        createdAt: String(product.createdAt || new Date().toISOString()),
        updatedAt: String(product.updatedAt || new Date().toISOString())
      });
    }

    return { valid: true, products: cleaned };
  }

  function clearAllData() {
    const ok = confirm("确认清空全部产品和时间线数据吗？此操作不可恢复。");
    if (!ok) return;
    state.products = [];
    saveData();
    render();
    closeDetailModal();
    closeProductModal();
  }

  function resetFilters() {
    els.searchName.value = "";
    els.searchSku.value = "";
    els.searchFactory.value = "";
    els.filterStage.value = "";
    els.filterRisk.value = "";
    els.sortDue.value = "asc";
    renderProductList();
  }

  function getDueStatus(product) {
    if (!product.dueDate) {
      return { type: "none", label: "无交期", daysLabel: "-", className: "tag-muted" };
    }
    if (product.stage === "已完成") {
      return { type: "done", label: "已完成", daysLabel: "已完成", className: "tag-ok" };
    }

    const due = toDate(product.dueDate);
    const today = getToday();
    const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);

    if (days < 0) {
      return { type: "overdue", label: "已逾期", daysLabel: `逾期 ${Math.abs(days)} 天`, className: "tag-overdue" };
    }
    if (days <= 7) {
      return { type: "near", label: "临近交期", daysLabel: days === 0 ? "今天到期" : `剩余 ${days} 天`, className: "tag-near" };
    }
    return { type: "ok", label: "交期正常", daysLabel: `剩余 ${days} 天`, className: "tag-ok" };
  }

  function getLatestTimeline(product) {
    if (!Array.isArray(product.timeline) || product.timeline.length === 0) return null;
    return [...product.timeline].sort((a, b) => {
      return new Date(b.recordTime).getTime() - new Date(a.recordTime).getTime();
    })[0];
  }

  function getRiskClass(risk) {
    if (risk === "正常") return "tag-normal";
    if (risk === "关注") return "tag-watch";
    if (risk === "高风险") return "tag-high";
    if (risk === "已逾期") return "tag-overdue";
    return "tag-muted";
  }

  function getTimelineStatusClass(status) {
    if (status === "已完成") return "tag-normal";
    if (status === "暂停") return "tag-paused";
    if (status === "进行中") return "tag-stage";
    return "tag-watch";
  }

  function findProduct(id) {
    return state.products.find((product) => product.id === id);
  }

  function openModal(modal) {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
    if (els.productModal.classList.contains("hidden") && els.detailModal.classList.contains("hidden")) {
      document.body.style.overflow = "";
    }
  }

  function closeModalOnBackdrop(event) {
    if (event.target === els.productModal) closeProductModal();
    if (event.target === els.detailModal) closeDetailModal();
  }

  function handleEscape(event) {
    if (event.key !== "Escape") return;
    if (!els.productModal.classList.contains("hidden")) closeProductModal();
    if (!els.detailModal.classList.contains("hidden")) closeDetailModal();
  }

  function getDefaultProducts() {
    const today = getToday();
    const inFiveDays = addDays(today, 5);
    const overdueDate = addDays(today, -3);
    const futureDate = addDays(today, 24);

    return [
      {
        id: createId("product"),
        name: "便携式咖啡保温杯",
        sku: "MUG-2026-001",
        factoryName: "宁波恒远五金制品厂",
        factoryContact: "张经理 13800000001",
        owner: "李明",
        image: "",
        startDate: toDateInput(addDays(today, -14)),
        dueDate: toDateInput(inFiveDays),
        stage: "生产中",
        risk: "关注",
        notes: "首批 3000 件，重点关注杯盖密封件交付。",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [
          {
            id: createId("timeline"),
            recordTime: toDateTimeInput(addHours(new Date(), -22)),
            actionType: "生产",
            content: "工厂反馈杯身喷涂已完成 60%，杯盖密封圈供应商本周内补齐。",
            nextAction: "确认密封圈到料时间并安排中期抽检。",
            nextDeadline: toDateInput(addDays(today, 2)),
            status: "进行中",
            notes: "需要采购同事同步供应商排产。",
            createdAt: new Date().toISOString()
          },
          {
            id: createId("timeline"),
            recordTime: toDateTimeInput(addDays(today, -8)),
            actionType: "确认",
            content: "产前样颜色、丝印和包装确认通过。",
            nextAction: "进入大货生产。",
            nextDeadline: toDateInput(addDays(today, -7)),
            status: "已完成",
            notes: "",
            createdAt: new Date().toISOString()
          }
        ]
      },
      {
        id: createId("product"),
        name: "桌面收纳盒套装",
        sku: "ORG-SET-088",
        factoryName: "东莞佳合塑胶有限公司",
        factoryContact: "王工 13800000002",
        owner: "周宁",
        image: "",
        startDate: toDateInput(addDays(today, -30)),
        dueDate: toDateInput(overdueDate),
        stage: "验货中",
        risk: "已逾期",
        notes: "外箱标签版本曾变更，验货需核对新版条码。",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [
          {
            id: createId("timeline"),
            recordTime: toDateTimeInput(addHours(new Date(), -8)),
            actionType: "验货",
            content: "AQL 初检发现 2 箱外箱标签贴错，已要求工厂全检返工。",
            nextAction: "明天复检标签和装箱数量。",
            nextDeadline: toDateInput(addDays(today, 1)),
            status: "待处理",
            notes: "该项目已超过原交期。",
            createdAt: new Date().toISOString()
          }
        ]
      },
      {
        id: createId("product"),
        name: "户外折叠营地灯",
        sku: "LAMP-CAMP-320",
        factoryName: "深圳明照电子科技",
        factoryContact: "陈小姐 13800000003",
        owner: "王倩",
        image: "",
        startDate: toDateInput(addDays(today, -6)),
        dueDate: toDateInput(futureDate),
        stage: "打样中",
        risk: "正常",
        notes: "客户要求暖白光和三档亮度，样品寄出前拍视频确认。",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [
          {
            id: createId("timeline"),
            recordTime: toDateTimeInput(addDays(today, -2)),
            actionType: "打样",
            content: "结构样已开模，预计 3 天后完成手板装配。",
            nextAction: "收到样品照片后确认按键手感。",
            nextDeadline: toDateInput(addDays(today, 3)),
            status: "进行中",
            notes: "",
            createdAt: new Date().toISOString()
          }
        ]
      }
    ];
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function trimValue(input) {
    return String(input.value || "").trim();
  }

  function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function getToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function toDate(value) {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isValidDateString(value) {
    if (!value) return false;
    return Boolean(toDate(value));
  }

  function toDateInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function toDateTimeInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  function formatDate(value) {
    if (!value) return "-";
    return String(value).slice(0, 10);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return String(value).replace("T", " ").slice(0, 16);
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function addHours(date, hours) {
    const d = new Date(date);
    d.setHours(d.getHours() + hours);
    return d;
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function isSafeImageData(value) {
    if (!value) return true;
    return typeof value === "string" && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
