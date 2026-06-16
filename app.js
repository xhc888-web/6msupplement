(function () {
  "use strict";

  const SUPABASE_URL = "https://cfwcpdouizirzfyiylmv.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2NwZG91aXppcnpmeWl5bG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MTI0ODksImV4cCI6MjA5NzA4ODQ4OX0.9L3fGJ8Q2SyH78tpIFNiEdyQPACSAHcnYm7dkGjjqMc";
  const STORAGE_KEY = "supplyChainProgressDashboard.v1";
  const IMAGE_BUCKET = "product-images";
  const STAGES = ["报价中", "打样中", "样品确认", "生产中", "验货中", "已出货", "已完成", "暂停"];
  const RISKS = ["正常", "关注", "高风险", "已逾期"];
  const ACTION_TYPES = ["报价", "打样", "修改", "确认", "生产", "验货", "发货", "付款", "其他"];
  const TIMELINE_STATUSES = ["待处理", "进行中", "已完成", "暂停"];

  const state = {
    products: [],
    selectedProductId: null,
    session: null,
    user: null,
    pendingImageFile: null,
    realtimeChannel: null,
    refreshTimer: null
  };

  let supabaseClient = null;
  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    populateStaticSelects();
    bindEvents();

    const configured = setupSupabase();
    if (!configured) {
      showAuth("请先在 app.js 中填写 Supabase anon public key。");
      return;
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      showAuth(error.message);
      return;
    }

    await handleSession(data.session);
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });
  }

  function setupSupabase() {
    if (!window.supabase || !SUPABASE_URL || SUPABASE_ANON_KEY.includes("PASTE_")) {
      return false;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }

  function cacheElements() {
    Object.assign(els, {
      authView: document.getElementById("authView"),
      authForm: document.getElementById("authForm"),
      authEmail: document.getElementById("authEmail"),
      authPassword: document.getElementById("authPassword"),
      loginBtn: document.getElementById("loginBtn"),
      registerBtn: document.getElementById("registerBtn"),
      authMessage: document.getElementById("authMessage"),
      appShell: document.getElementById("appShell"),
      userInfo: document.getElementById("userInfo"),
      syncStatus: document.getElementById("syncStatus"),
      signOutBtn: document.getElementById("signOutBtn"),
      migrateLocalBtn: document.getElementById("migrateLocalBtn"),
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
    els.authForm.addEventListener("submit", handleLogin);
    els.registerBtn.addEventListener("click", handleRegister);
    els.signOutBtn.addEventListener("click", handleSignOut);
    els.migrateLocalBtn.addEventListener("click", migrateLocalData);
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
    els.detailBody.addEventListener("click", handleDetailBodyClick);
    els.productModal.addEventListener("click", closeModalOnBackdrop);
    els.detailModal.addEventListener("click", closeModalOnBackdrop);
    document.addEventListener("keydown", handleEscape);
  }

  async function handleSession(session) {
    state.session = session;
    state.user = session && session.user ? session.user : null;
    state.selectedProductId = null;

    if (!state.user) {
      stopRealtime();
      state.products = [];
      showAuth("");
      render();
      return;
    }

    showApp();
    await loadCloudData();
    startRealtime();
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthMessage("");
    setAuthBusy(true);
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: trimValue(els.authEmail),
      password: els.authPassword.value
    });
    setAuthBusy(false);
    if (error) setAuthMessage(`登录失败：${error.message}`);
  }

  async function handleRegister() {
    setAuthMessage("");
    if (!els.authForm.reportValidity()) return;
    setAuthBusy(true);
    const { data, error } = await supabaseClient.auth.signUp({
      email: trimValue(els.authEmail),
      password: els.authPassword.value
    });
    setAuthBusy(false);
    if (error) {
      setAuthMessage(`注册失败：${error.message}`);
      return;
    }
    if (!data.session) {
      setAuthMessage("注册成功，请按邮箱提示完成确认后再登录。", true);
    }
  }

  async function handleSignOut() {
    stopRealtime();
    await supabaseClient.auth.signOut();
  }

  function showAuth(message) {
    els.authView.classList.remove("hidden");
    els.appShell.classList.add("hidden");
    setAuthMessage(message || "");
  }

  function showApp() {
    els.authView.classList.add("hidden");
    els.appShell.classList.remove("hidden");
    els.userInfo.textContent = state.user.email || state.user.id;
    updateMigrationButton();
  }

  async function loadCloudData() {
    if (!state.user) return;
    setSyncStatus("正在从 Supabase 读取数据...");

    const { data: products, error: productError } = await supabaseClient
      .from("products")
      .select("*")
      .eq("user_id", state.user.id)
      .order("updated_at", { ascending: false });

    if (productError) {
      setSyncStatus(`读取产品失败：${productError.message}`);
      return;
    }

    const productIds = (products || []).map((item) => item.id);
    let logs = [];
    if (productIds.length) {
      const { data: logRows, error: logError } = await supabaseClient
        .from("product_logs")
        .select("*")
        .eq("user_id", state.user.id)
        .in("product_id", productIds)
        .order("log_date", { ascending: false });

      if (logError) {
        setSyncStatus(`读取时间线失败：${logError.message}`);
        return;
      }
      logs = logRows || [];
    }

    const logsByProduct = new Map();
    logs.forEach((log) => {
      if (!logsByProduct.has(log.product_id)) logsByProduct.set(log.product_id, []);
      logsByProduct.get(log.product_id).push(normalizeLog(log));
    });

    state.products = (products || []).map((product) => normalizeProduct(product, logsByProduct.get(product.id) || []));
    render();
    setSyncStatus(`已同步 ${state.products.length} 个产品`);
  }

  function startRealtime() {
    if (!state.user) return;
    stopRealtime();

    state.realtimeChannel = supabaseClient
      .channel(`supply-chain-sync-${state.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `user_id=eq.${state.user.id}`
        },
        scheduleCloudRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_logs",
          filter: `user_id=eq.${state.user.id}`
        },
        scheduleCloudRefresh
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSyncStatus(`已同步 ${state.products.length} 个产品，实时同步已连接`);
        }
      });
  }

  function stopRealtime() {
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }
    if (state.realtimeChannel) {
      supabaseClient.removeChannel(state.realtimeChannel);
      state.realtimeChannel = null;
    }
  }

  function scheduleCloudRefresh() {
    if (state.refreshTimer) clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null;
      loadCloudData();
    }, 400);
  }

  function normalizeProduct(row, timeline) {
    return {
      id: row.id,
      name: row.name || "",
      sku: row.sku || "",
      factoryName: row.factory || "",
      factoryContact: row.factory_contact || "",
      owner: row.owner || "",
      image: row.image_url || "",
      startDate: row.start_date || "",
      dueDate: row.due_date || "",
      stage: row.status || "报价中",
      risk: row.risk || "正常",
      notes: row.note || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || "",
      timeline
    };
  }

  function normalizeLog(row) {
    return {
      id: row.id,
      productId: row.product_id,
      recordTime: row.log_date || row.created_at || "",
      actionType: row.type || "其他",
      content: row.content || "",
      nextAction: row.next_step || "",
      nextDeadline: row.deadline || "",
      status: row.status || "待处理",
      notes: row.note || "",
      createdAt: row.created_at || ""
    };
  }

  function render() {
    renderStats();
    renderProductList();
    updateMigrationButton();
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
    state.pendingImageFile = null;
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

  async function handleProductSubmit(event) {
    event.preventDefault();
    const user = await requireCurrentUser();
    if (!user || !els.productForm.reportValidity()) return;

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

    const id = els.productId.value || crypto.randomUUID();
    setSyncStatus("正在保存产品...");

    try {
      if (state.pendingImageFile) {
        const imageUrl = await uploadProductImage(state.pendingImageFile, id);
        if (!imageUrl) return;
        payload.image = imageUrl;
      }

      if (els.productId.value) {
        await updateProduct(id, payload);
      } else {
        await createProduct(id, payload);
      }
    } catch (error) {
      const message = `保存失败：${error.message || error}`;
      setSyncStatus(message);
      alert(message);
    }
  }

  async function createProduct(id, payload) {
    const user = await requireCurrentUser();
    if (!user) return;
    const row = toProductRow(id, payload, user.id);
    const { data, error } = await withTimeout(
      supabaseClient
        .from("products")
        .insert(row)
        .select()
        .single(),
      "保存产品超时，请检查网络或 Supabase RLS 设置。"
    );

    if (error) {
      const message = `保存失败：${error.message}`;
      setSyncStatus(message);
      alert(message);
      return;
    }

    state.products.unshift(normalizeProduct(data, []));
    state.pendingImageFile = null;
    render();
    closeProductModal();
    setSyncStatus("产品已保存到 Supabase");
  }

  async function updateProduct(id, payload) {
    const user = await requireCurrentUser();
    if (!user) return;
    const row = toProductRow(id, payload, user.id);
    delete row.id;
    delete row.user_id;
    delete row.created_at;

    const { data, error } = await withTimeout(
      supabaseClient
        .from("products")
        .update(row)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single(),
      "更新产品超时，请检查网络或 Supabase RLS 设置。"
    );

    if (error) {
      const message = `保存失败：${error.message}`;
      setSyncStatus(message);
      alert(message);
      return;
    }

    const index = state.products.findIndex((item) => item.id === id);
    const timeline = index === -1 ? [] : state.products[index].timeline;
    const normalized = normalizeProduct(data, timeline);
    if (index !== -1) state.products[index] = normalized;
    state.pendingImageFile = null;
    render();
    closeProductModal();
    setSyncStatus("产品已更新到 Supabase");
  }

  function toProductRow(id, product, userId) {
    const now = new Date().toISOString();
    return {
      id,
      user_id: userId || state.user.id,
      name: product.name,
      sku: product.sku,
      factory: product.factoryName,
      factory_contact: product.factoryContact || null,
      owner: product.owner,
      image_url: product.image || null,
      start_date: product.startDate,
      due_date: product.dueDate,
      status: product.stage,
      risk: product.risk,
      note: product.notes || null,
      updated_at: now,
      created_at: product.createdAt || now
    };
  }

  async function deleteProduct(id) {
    const user = await requireCurrentUser();
    if (!user) return;
    const product = findProduct(id);
    if (!product) return;
    const ok = confirm(`确认删除产品「${product.name}」吗？此操作不可恢复。`);
    if (!ok) return;

    setSyncStatus("正在删除产品...");
    const { error } = await supabaseClient
      .from("products")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setSyncStatus(`删除失败：${error.message}`);
      return;
    }

    state.products = state.products.filter((item) => item.id !== id);
    if (state.selectedProductId === id) closeDetailModal();
    render();
    setSyncStatus("产品已删除");
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

    state.pendingImageFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      els.imageData.value = "";
      renderImagePreview(reader.result);
    };
    reader.onerror = () => alert("图片读取失败，请重试。");
    reader.readAsDataURL(file);
  }

  async function uploadProductImage(file, productId) {
    const user = await requireCurrentUser();
    if (!user) return "";
    const extension = getFileExtension(file.name);
    const path = `${user.id}/${productId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await withTimeout(
      supabaseClient.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type || "image/jpeg",
          upsert: false
        }),
      "图片上传超时，请检查网络或 Storage policy 设置。"
    );

    if (error) {
      const message = `图片上传失败：${error.message}`;
      setSyncStatus(message);
      alert(message);
      return "";
    }

    const { data } = supabaseClient.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function uploadImageDataUrl(dataUrl, productId) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const extension = blob.type.split("/")[1] || "jpg";
    const file = new File([blob], `legacy-image.${extension}`, { type: blob.type || "image/jpeg" });
    return uploadProductImage(file, productId);
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
    state.pendingImageFile = null;
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
    const form = document.getElementById("timelineForm");
    const submitButton = form.querySelector("button.btn-primary");
    if (submitButton) {
      submitButton.type = "button";
    }
    form.addEventListener("submit", handleTimelineSubmit);
  }

  function handleDetailBodyClick(event) {
    const button = event.target.closest("button");
    if (!button) return;
    const form = button.closest("#timelineForm");
    if (!form || !button.classList.contains("btn-primary")) return;
    event.preventDefault();
    saveTimelineFromForm(form);
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

  async function handleTimelineSubmit(event) {
    event.preventDefault();
    await saveTimelineFromForm(event.currentTarget);
  }

  async function saveTimelineFromForm(form) {
    if (form.dataset.saving === "true") return;
    form.dataset.saving = "true";
    setTimelineFormMessage("正在准备保存时间线...", true);

    const user = await requireCurrentUser();
    if (!user) {
      form.dataset.saving = "false";
      return;
    }
    const product = findProduct(state.selectedProductId);
    if (!product) {
      form.dataset.saving = "false";
      setTimelineFormMessage("添加记录失败：没有找到当前产品，请关闭详情后重新打开。");
      return;
    }

    if (!form.reportValidity()) {
      form.dataset.saving = "false";
      return;
    }
    const submitButton = form.querySelector("button.btn-primary");
    setTimelineFormMessage("");
    if (submitButton) submitButton.disabled = true;

    try {
      const row = {
        id: crypto.randomUUID(),
        product_id: product.id,
        user_id: user.id,
        log_date: toIsoFromLocal(document.getElementById("recordTime").value),
        type: document.getElementById("actionType").value,
        content: trimValue(document.getElementById("recordContent")),
        next_step: trimValue(document.getElementById("nextAction")) || null,
        deadline: document.getElementById("nextDeadline").value || null,
        status: document.getElementById("timelineStatus").value,
        note: trimValue(document.getElementById("timelineNotes")) || null
      };

      setSyncStatus("正在保存时间线...");
      setTimelineFormMessage("正在保存时间线...", true);
      const { data, error } = await withTimeout(
        supabaseClient
          .from("product_logs")
          .insert(row)
          .select()
          .single(),
        "保存时间线超时，请检查网络或 Supabase RLS 设置。"
      );

      if (error) {
        throw new Error(error.message);
      }

      await touchProduct(product.id);
      product.timeline = Array.isArray(product.timeline) ? product.timeline : [];
      product.timeline.push(normalizeLog(data));
      product.updatedAt = new Date().toISOString();
      render();
      renderDetail(product);
      setSyncStatus("时间线已保存");
    } catch (error) {
      const message = `添加记录失败：${error.message || error}`;
      setSyncStatus(message);
      setTimelineFormMessage(message);
      alert(message);
    } finally {
      form.dataset.saving = "false";
      if (submitButton) submitButton.disabled = false;
    }
  }

  async function deleteTimelineItem(timelineId) {
    const user = await requireCurrentUser();
    if (!user) return;
    const product = findProduct(state.selectedProductId);
    if (!product) return;
    const ok = confirm("确认删除这条时间线记录吗？");
    if (!ok) return;

    const { error } = await supabaseClient
      .from("product_logs")
      .delete()
      .eq("id", timelineId)
      .eq("user_id", user.id);

    if (error) {
      setSyncStatus(`删除时间线失败：${error.message}`);
      return;
    }

    await touchProduct(product.id);
    product.timeline = (product.timeline || []).filter((item) => item.id !== timelineId);
    product.updatedAt = new Date().toISOString();
    render();
    renderDetail(product);
    setSyncStatus("时间线已删除");
  }

  async function touchProduct(productId) {
    const user = await requireCurrentUser();
    if (!user) return;
    await supabaseClient
      .from("products")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("user_id", user.id);
  }

  function exportData() {
    const data = {
      version: 2,
      source: "supabase",
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
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const checked = validateImportData(parsed);
        if (!checked.valid) {
          alert(`导入失败：${checked.message}`);
          return;
        }
        const ok = confirm(`确认导入 ${checked.products.length} 个产品吗？当前云端数据将被覆盖。`);
        if (!ok) return;
        await uploadProductsToCloud(checked.products, { replace: true });
        closeDetailModal();
        closeProductModal();
        alert("导入成功，数据已保存到 Supabase。");
      } catch (error) {
        alert(`导入失败：${error.message || "JSON 文件无法解析。"}`);
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

  async function migrateLocalData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      alert("没有检测到旧的本地数据。");
      return;
    }

    const checked = validateImportData(JSON.parse(raw));
    if (!checked.valid || checked.products.length === 0) {
      alert("旧本地数据为空或格式不正确，无法迁移。");
      return;
    }

    const ok = confirm(`检测到 ${checked.products.length} 个旧本地产品，是否上传到当前账号的 Supabase？`);
    if (!ok) return;

    await uploadProductsToCloud(checked.products, { replace: false });
    const clear = confirm("迁移成功。是否清空旧 localStorage 数据？");
    if (clear) localStorage.removeItem(STORAGE_KEY);
    updateMigrationButton();
  }

  async function uploadProductsToCloud(products, options) {
    const user = await requireCurrentUser();
    if (!user) throw new Error("请先登录。");
    const replace = Boolean(options && options.replace);
    setSyncStatus(replace ? "正在覆盖导入云端数据..." : "正在迁移本地数据到云端...");

    const productRows = [];
    const logRows = [];

    for (const product of products) {
      const productId = isUuid(product.id) ? product.id : crypto.randomUUID();
      let imageUrl = product.image || "";
      if (isImageDataUrl(imageUrl)) {
        imageUrl = await uploadImageDataUrl(imageUrl, productId);
      }

      productRows.push(toProductRow(productId, { ...product, image: imageUrl }, user.id));
      (product.timeline || []).forEach((item) => {
        logRows.push({
          id: isUuid(item.id) ? item.id : crypto.randomUUID(),
          product_id: productId,
          user_id: user.id,
          log_date: toIsoFromLocal(item.recordTime),
          type: item.actionType,
          content: item.content,
          next_step: item.nextAction || null,
          deadline: item.nextDeadline || null,
          status: item.status,
          note: item.notes || null,
          created_at: item.createdAt || new Date().toISOString()
        });
      });
    }

    if (replace) {
      const { error } = await supabaseClient
        .from("products")
        .delete()
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    }

    if (productRows.length) {
      const { error } = await supabaseClient.from("products").insert(productRows);
      if (error) throw new Error(error.message);
    }
    if (logRows.length) {
      const { error } = await supabaseClient.from("product_logs").insert(logRows);
      if (error) throw new Error(error.message);
    }

    await loadCloudData();
    setSyncStatus(replace ? "导入完成" : "迁移完成");
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
      const required = ["name", "sku", "owner", "startDate", "dueDate", "stage", "risk"];
      for (const key of required) {
        if (!String(product[key] || "").trim()) {
          return { valid: false, message: `第 ${index + 1} 个产品缺少字段：${key}。` };
        }
      }
      if (!String(product.factoryName || product.factory || "").trim()) {
        return { valid: false, message: `第 ${index + 1} 个产品缺少字段：factoryName。` };
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
          id: String(item.id || crypto.randomUUID()),
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
        id: String(product.id || crypto.randomUUID()),
        name: String(product.name).trim().slice(0, 80),
        sku: String(product.sku).trim().slice(0, 60),
        factoryName: String(product.factoryName || product.factory).trim().slice(0, 80),
        factoryContact: String(product.factoryContact || product.factory_contact || "").trim().slice(0, 80),
        owner: String(product.owner).trim().slice(0, 60),
        image: isSafeImageValue(product.image || product.image_url) ? String(product.image || product.image_url || "") : "",
        startDate: product.startDate,
        dueDate: product.dueDate,
        stage: product.stage,
        risk: product.risk,
        notes: String(product.notes || product.note || "").slice(0, 500),
        timeline: cleanedTimeline,
        createdAt: String(product.createdAt || product.created_at || new Date().toISOString()),
        updatedAt: String(product.updatedAt || product.updated_at || new Date().toISOString())
      });
    }

    return { valid: true, products: cleaned };
  }

  async function clearAllData() {
    const user = await requireCurrentUser();
    if (!user) return;
    const ok = confirm("确认清空当前账号的全部产品和时间线数据吗？此操作不可恢复。");
    if (!ok) return;
    const { error } = await supabaseClient
      .from("products")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      setSyncStatus(`清空失败：${error.message}`);
      return;
    }

    state.products = [];
    render();
    closeDetailModal();
    closeProductModal();
    setSyncStatus("云端数据已清空");
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

  function updateMigrationButton() {
    if (!els.migrateLocalBtn) return;
    els.migrateLocalBtn.disabled = !hasLegacyLocalData();
    els.migrateLocalBtn.title = els.migrateLocalBtn.disabled ? "未检测到旧 localStorage 数据" : "";
  }

  function hasLegacyLocalData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const checked = validateImportData(JSON.parse(raw));
      return checked.valid && checked.products.length > 0;
    } catch (_error) {
      return false;
    }
  }

  function setAuthBusy(isBusy) {
    els.loginBtn.disabled = isBusy;
    els.registerBtn.disabled = isBusy;
  }

  function setAuthMessage(message, success) {
    els.authMessage.textContent = message || "";
    els.authMessage.classList.toggle("success", Boolean(success));
  }

  function setSyncStatus(message) {
    els.syncStatus.textContent = message || "";
  }

  function withTimeout(promise, message, timeoutMs = 15000) {
    return Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        window.setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  }

  function setTimelineFormMessage(message, success) {
    const form = document.getElementById("timelineForm");
    if (!form) return;

    let messageEl = document.getElementById("timelineFormMessage");
    if (!messageEl) {
      messageEl = document.createElement("p");
      messageEl.id = "timelineFormMessage";
      messageEl.className = "form-message";
      const actions = form.querySelector(".form-actions");
      if (actions) actions.prepend(messageEl);
      else form.appendChild(messageEl);
    }

    messageEl.textContent = message || "";
    messageEl.classList.toggle("success", Boolean(success));
  }

  async function requireCurrentUser() {
    if (state.user) {
      return state.user;
    }

    if (state.session && state.session.user) {
      state.user = state.session.user;
      return state.user;
    }

    const { data } = await supabaseClient.auth.getSession();
    if (data.session && data.session.user) {
      state.session = data.session;
      state.user = data.session.user;
      return state.user;
    }

    {
      state.user = null;
      state.session = null;
      showAuth("登录状态已失效，请重新登录。");
      return null;
    }
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function trimValue(input) {
    return String(input.value || "").trim();
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

  function toIsoFromLocal(value) {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  }

  function formatDate(value) {
    if (!value) return "-";
    return String(value).slice(0, 10);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).replace("T", " ").slice(0, 16);
    return toDateTimeInput(date).replace("T", " ");
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function isSafeImageValue(value) {
    if (!value) return true;
    return isImageDataUrl(value) || /^https:\/\/[\w.-]+/i.test(String(value));
  }

  function isImageDataUrl(value) {
    return typeof value === "string" && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value);
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function getFileExtension(name) {
    return String(name || "image.jpg").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
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
