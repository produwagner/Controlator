/* MÓDULO DE INTERFACE DO USUÁRIO (UI) */

let categoryChart = null;
let dailyChart = null;
let isEditingCards = false;
let isEditingCategories = false;
let isEditingPayments = false;
let currentHistPeriod = 'mensal';
let currentConfigs = {};

// Inicializa ouvintes de eventos da interface
export function initUI(callbacks) {
  // 1. Alternar Abas (Tabs)
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetTab = link.getAttribute('data-tab');
      
      // Remover classe active de todos os nav links e tab panes
      navLinks.forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      // Adicionar active no link clicado e aba correta
      link.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.add('active');

      if (targetTab === 'transactions') {
        // Reset filter search input
        const filterSearch = document.getElementById('filter-search');
        if (filterSearch) filterSearch.value = '';

        // Reset period filter to 'mensal' and current month
        const now = new Date();
        const monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        const histMonthInput = document.getElementById('hist-month-input');
        if (histMonthInput) histMonthInput.value = monthStr;

        const mensalBtn = document.querySelector('#hist-period-buttons .btn-period[data-period="mensal"]');
        if (mensalBtn) {
          const btns = document.querySelectorAll('#hist-period-buttons .btn-period');
          btns.forEach(b => b.classList.remove('active'));
          mensalBtn.classList.add('active');
          currentHistPeriod = 'mensal';
          updateHistSelectors('mensal');
        }

        if (callbacks.onTransactionsTabOpen) {
          callbacks.onTransactionsTabOpen();
        }
      }
    });
  });

  // 2. Controlar Modal de Lançamentos
  const modal = document.getElementById('modal-transaction');
  const btnQuick = document.getElementById('btn-quick-transaction');
  const btnAdd = document.getElementById('btn-add-transaction');
  const btnClose = document.getElementById('btn-close-modal');
  const btnCancel = document.getElementById('btn-cancel-modal');
  const formTx = document.getElementById('form-transaction');

  const openModal = () => {
    // Definir data padrão como hoje
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    modal.classList.remove('hidden');
  };

  const closeModal = () => {
    formTx.reset();
    modal.classList.add('hidden');
  };

  // Speed Dial Menu Flutuante no Mobile
  const fabMenu = document.getElementById('fab-menu');
  const btnFabAddExpense = document.getElementById('btn-fab-add-expense');
  const btnFabImportInvoice = document.getElementById('btn-fab-import-invoice');

  const toggleFabMenu = (show) => {
    if (!fabMenu) return;
    if (show === undefined) {
      show = !fabMenu.classList.contains('show');
    }
    if (show) {
      fabMenu.classList.remove('hidden');
      // Forçar reflow para iniciar transição
      fabMenu.offsetHeight;
      fabMenu.classList.add('show');
      if (btnQuick) btnQuick.classList.add('active');
    } else {
      fabMenu.classList.remove('show');
      if (btnQuick) btnQuick.classList.remove('active');
      // Esperar transição acabar antes de ocultar
      setTimeout(() => {
        if (!fabMenu.classList.contains('show')) {
          fabMenu.classList.add('hidden');
        }
      }, 250);
    }
  };

  if (btnQuick) {
    btnQuick.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFabMenu();
    });
  }

  if (btnFabAddExpense) {
    btnFabAddExpense.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFabMenu(false);
      openModal();
    });
  }

  if (btnFabImportInvoice) {
    btnFabImportInvoice.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFabMenu(false);
      
      // Simular clique no botão de importação padrão
      const btnImportInvoice = document.getElementById('btn-import-invoice');
      if (btnImportInvoice) {
        btnImportInvoice.click();
      }
    });
  }

  // Fechar o menu ao clicar fora
  document.addEventListener('click', () => {
    toggleFabMenu(false);
  });

  if (btnAdd) btnAdd.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  // Fechar clicando fora da caixinha
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // 3. Submissão do Formulário de Transação
  formTx.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('tx-date').value;
    const type = document.getElementById('tx-type').value;
    const category = document.getElementById('tx-category').value;
    const value = Math.abs(parseFloat(document.getElementById('tx-value').value));
    const account = document.getElementById('tx-account').value;
    const description = document.getElementById('tx-description').value;

    if (callbacks.onAddTransaction) {
      callbacks.onAddTransaction({ date, type, category, value, account, description });
    }
    closeModal();
  });

  // 4. Submissão do Formulário de Configurações de Cartões
  const formSettings = document.getElementById('form-settings-cards');
  if (formSettings) {
    formSettings.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const cardInputs = document.querySelectorAll('#settings-cards-container input');
      const updatedConfigs = {};
      
      cardInputs.forEach(input => {
        const idParts = input.id.split('-'); // ["config", cardId, field]
        if (idParts.length === 3) {
          const cardId = idParts[1];
          const field = idParts[2]; // "limit", "closing", "due"
          
          const keyMap = { limit: 'limite', closing: 'fechamento', due: 'vencimento' };
          const configKey = `${cardId}_${keyMap[field]}`;
          updatedConfigs[configKey] = input.value;
        }
      });

      if (callbacks.onSaveSettings) {
        callbacks.onSaveSettings(updatedConfigs);
      }

      // Concluir edição de cartões após salvar
      isEditingCards = false;
      const containerEl = document.getElementById('credit-cards-container');
      const btnToggle = document.getElementById('btn-toggle-edit-cards');
      const btnIcon = document.getElementById('edit-cards-btn-icon');
      const btnText = document.getElementById('edit-cards-btn-text');
      
      formSettings.classList.add('hidden');
      if (containerEl) containerEl.classList.remove('hidden');
      if (btnToggle) {
        btnToggle.className = 'btn btn-secondary';
        btnToggle.title = 'Personalizar';
      }
      if (btnIcon) btnIcon.setAttribute('data-lucide', 'settings');
      if (btnText) btnText.innerText = 'Personalizar';
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  }

  // 5. Filtros de Transações
  const filters = ['filter-search'];
  filters.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        if (callbacks.onFilterChange) {
          callbacks.onFilterChange();
        }
      });
      el.addEventListener('change', () => {
        if (callbacks.onFilterChange) {
          callbacks.onFilterChange();
        }
      });
    }
  });

  // 5b. Filtros de Período do Histórico — seletores nativos simples
  const histYearSel    = document.getElementById('hist-year-sel');
  const histMonthInput = document.getElementById('hist-month-input');
  const histWeekInput  = document.getElementById('hist-week-input');
  const histDayInput   = document.getElementById('hist-day-input');

  // Popula o dropdown de anos (Anual)
  function populateHistYearSel() {
    if (!histYearSel || histYearSel.options.length > 0) return;
    const now = new Date();
    const dashYearEl = document.getElementById('dashboard-year-selector');
    let years = dashYearEl && dashYearEl.options.length > 0
      ? Array.from(dashYearEl.options).map(o => Number(o.value))
      : [now.getFullYear()];
    if (!years.includes(now.getFullYear())) years.unshift(now.getFullYear());
    years.sort((a, b) => b - a);
    histYearSel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    histYearSel.value = now.getFullYear();
  }

  // Mostra/oculta seletores conforme o período
  function updateHistSelectors(period) {
    const now = new Date();
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    const show = el => el && (el.style.display = '');
    const hide = el => el && (el.style.display = 'none');

    hide(histYearSel); hide(histMonthInput); hide(histWeekInput); hide(histDayInput);

    if (period === 'anual') {
      populateHistYearSel();
      show(histYearSel);
    } else if (period === 'mensal') {
      if (histMonthInput && !histMonthInput.value) histMonthInput.value = monthStr;
      show(histMonthInput);
    } else if (period === 'semanal') {
      if (histWeekInput && !histWeekInput.value) histWeekInput.value = todayStr;
      show(histWeekInput);
    } else if (period === 'diario') {
      if (histDayInput && !histDayInput.value) histDayInput.value = todayStr;
      show(histDayInput);
    }
  }

  // Inicializar estado dos seletores do histórico
  updateHistSelectors(currentHistPeriod);

  // Clique nos botões de período
  const histPeriodButtons = document.querySelectorAll('#hist-period-buttons .btn-period');
  histPeriodButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      histPeriodButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentHistPeriod = btn.getAttribute('data-period');
      updateHistSelectors(currentHistPeriod);
      if (callbacks.onFilterChange) callbacks.onFilterChange();
    });
  });

  // Mudança em qualquer seletor de subperíodo → filtrar
  [histYearSel, histMonthInput, histWeekInput, histDayInput].forEach(el => {
    if (!el) return;
    el.addEventListener('change', () => {
      if (callbacks.onFilterChange) callbacks.onFilterChange();
    });
  });

  // 6. Botão Sincronizar Agora
  const btnSync = document.getElementById('btn-sync-now');
  if (btnSync && callbacks.onSyncNow) {
    btnSync.addEventListener('click', callbacks.onSyncNow);
  }

  // 7. Controlar Modal de Cadastro de Cartão
  const cardModal = document.getElementById('modal-add-card');
  const btnShowAddCard = document.getElementById('btn-show-add-card');
  const btnCloseCardModal = document.getElementById('btn-close-card-modal');
  const btnCancelCardModal = document.getElementById('btn-cancel-card-modal');
  const formAddCard = document.getElementById('form-add-card');

  const openCardModal = () => {
    cardModal.classList.remove('hidden');
  };

  const closeCardModal = () => {
    formAddCard.reset();
    cardModal.classList.add('hidden');
  };

  const btnShowAddCardFromTab = document.getElementById('btn-show-add-card-from-tab');

  if (btnShowAddCard) btnShowAddCard.addEventListener('click', openCardModal);
  if (btnShowAddCardFromTab) btnShowAddCardFromTab.addEventListener('click', openCardModal);
  if (btnCloseCardModal) btnCloseCardModal.addEventListener('click', closeCardModal);
  if (btnCancelCardModal) btnCancelCardModal.addEventListener('click', closeCardModal);

  const btnToggleEditCards = document.getElementById('btn-toggle-edit-cards');
  if (btnToggleEditCards) {
    btnToggleEditCards.addEventListener('click', () => {
      isEditingCards = !isEditingCards;
      
      const formEl = document.getElementById('form-settings-cards');
      const containerEl = document.getElementById('credit-cards-container');
      const btnIcon = document.getElementById('edit-cards-btn-icon');
      const btnText = document.getElementById('edit-cards-btn-text');
      
      if (isEditingCards) {
        if (formEl) formEl.classList.remove('hidden');
        if (containerEl) containerEl.classList.add('hidden');
        btnToggleEditCards.className = 'btn btn-primary';
        btnToggleEditCards.title = 'Concluir';
        if (btnIcon) btnIcon.setAttribute('data-lucide', 'check-circle');
        if (btnText) btnText.innerText = 'Concluir';
      } else {
        if (formEl) formEl.classList.add('hidden');
        if (containerEl) containerEl.classList.remove('hidden');
        btnToggleEditCards.className = 'btn btn-secondary';
        btnToggleEditCards.title = 'Personalizar';
        if (btnIcon) btnIcon.setAttribute('data-lucide', 'settings');
        if (btnText) btnText.innerText = 'Personalizar';
      }
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  }

  cardModal.addEventListener('click', (e) => {
    if (e.target === cardModal) closeCardModal();
  });

  formAddCard.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('card-new-name').value;
    const limit = parseFloat(document.getElementById('card-new-limit').value);
    const closing = parseInt(document.getElementById('card-new-closing').value);
    const due = parseInt(document.getElementById('card-new-due').value);

    if (callbacks.onAddCard) {
      callbacks.onAddCard({ name, limit, closing, due });
    }
    closeCardModal();
  });

  // 8. Event Delegation para Excluir Cartão
  const cardsSettingsContainer = document.getElementById('settings-cards-container');
  if (cardsSettingsContainer) {
    cardsSettingsContainer.addEventListener('click', (e) => {
      const btnDelete = e.target.closest('.btn-delete-card');
      if (btnDelete) {
        const cardId = btnDelete.getAttribute('data-id');
        const cardName = btnDelete.getAttribute('data-name');
        if (confirm(`Deseja realmente excluir o cartão "${cardName}"?`)) {
          if (callbacks.onDeleteCard) {
            callbacks.onDeleteCard(cardId);
          }
        }
      }
    });
  }

  // ==========================================
  // GERENCIAMENTO DE CATEGORIAS DINÂMICAS
  // ==========================================

  // 1. Alternar Modo de Edição de Categorias
  const btnToggleEditCategories = document.getElementById('btn-toggle-edit-categories');
  if (btnToggleEditCategories) {
    btnToggleEditCategories.addEventListener('click', () => {
      isEditingCategories = !isEditingCategories;
      
      const formEl = document.getElementById('form-settings-categories');
      const containerEl = document.getElementById('categories-list-container');
      const btnIcon = document.getElementById('edit-categories-btn-icon');
      
      if (isEditingCategories) {
        if (formEl) formEl.classList.remove('hidden');
        if (containerEl) containerEl.classList.add('hidden');
        btnToggleEditCategories.className = 'btn btn-primary';
        btnToggleEditCategories.title = 'Concluir';
        if (btnIcon) btnIcon.setAttribute('data-lucide', 'check-circle');
      } else {
        if (formEl) formEl.classList.add('hidden');
        if (containerEl) containerEl.classList.remove('hidden');
        btnToggleEditCategories.className = 'btn btn-secondary';
        btnToggleEditCategories.title = 'Personalizar';
        if (btnIcon) btnIcon.setAttribute('data-lucide', 'settings');
      }
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  }

  // 2. Salvar Alterações de Categorias
  const formSettingsCategories = document.getElementById('form-settings-categories');
  if (formSettingsCategories) {
    formSettingsCategories.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const catRows = document.querySelectorAll('#settings-categories-container .settings-edit-row');
      const updatedConfigs = {};
      
      catRows.forEach(row => {
        const catId = row.getAttribute('data-id');
        const nameVal = document.getElementById(`cat-edit-${catId}-name`).value;
        const typeVal = document.getElementById(`cat-edit-${catId}-type`).value;
        const iconVal = document.getElementById(`cat-edit-${catId}-icon`).value;
        const colorVal = document.getElementById(`cat-edit-${catId}-color`).value;
        
        updatedConfigs[`${catId}_nome`] = nameVal;
        updatedConfigs[`${catId}_tipo`] = typeVal;
        updatedConfigs[`${catId}_icon`] = iconVal;
        updatedConfigs[`${catId}_color`] = colorVal;
      });

      if (callbacks.onSaveCategories) {
        callbacks.onSaveCategories(updatedConfigs);
      }

      // Concluir edição
      isEditingCategories = false;
      const formEl = document.getElementById('form-settings-categories');
      const containerEl = document.getElementById('categories-list-container');
      const btnToggle = document.getElementById('btn-toggle-edit-categories');
      const btnIcon = document.getElementById('edit-categories-btn-icon');
      
      if (formEl) formEl.classList.add('hidden');
      if (containerEl) containerEl.classList.remove('hidden');
      if (btnToggle) {
        btnToggle.className = 'btn btn-secondary';
        btnToggle.title = 'Personalizar';
      }
      if (btnIcon) btnIcon.setAttribute('data-lucide', 'settings');
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  }

  // 3. Controlar Modal de Cadastro de Categoria
  const categoryModal = document.getElementById('modal-add-category');
  const btnShowAddCategory = document.getElementById('btn-show-add-category');
  const btnCloseCategoryModal = document.getElementById('btn-close-category-modal');
  const btnCancelCategoryModal = document.getElementById('btn-cancel-category-modal');
  const formAddCategory = document.getElementById('form-add-category');

  const openCategoryModal = () => {
    if (categoryModal) categoryModal.classList.remove('hidden');
  };

  const closeCategoryModal = () => {
    if (formAddCategory) {
      formAddCategory.reset();
      // Visually reset custom picker
      const triggerIcon = document.getElementById('cat-add-icon-trigger')?.querySelector('i');
      if (triggerIcon) triggerIcon.setAttribute('data-lucide', 'tag');
      const triggerLabel = document.getElementById('cat-add-icon-label');
      if (triggerLabel) triggerLabel.textContent = 'Etiqueta (Padrão)';
      const popover = document.getElementById('cat-add-icon-popover');
      if (popover) {
        popover.querySelectorAll('.btn-picker-option').forEach(opt => {
          if (opt.getAttribute('data-value') === 'tag') opt.classList.add('active');
          else opt.classList.remove('active');
        });
      }
      if (window.lucide) window.lucide.createIcons();
    }
    if (categoryModal) categoryModal.classList.add('hidden');
  };

  if (btnShowAddCategory) btnShowAddCategory.addEventListener('click', openCategoryModal);
  if (btnCloseCategoryModal) btnCloseCategoryModal.addEventListener('click', closeCategoryModal);
  if (btnCancelCategoryModal) btnCancelCategoryModal.addEventListener('click', closeCategoryModal);
  if (categoryModal) {
    categoryModal.addEventListener('click', (e) => {
      if (e.target === categoryModal) closeCategoryModal();
    });
  }

  if (formAddCategory) {
    formAddCategory.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-name').value;
      const type = document.getElementById('cat-type').value;
      const icon = document.getElementById('cat-icon').value;
      const color = document.getElementById('cat-color').value;

      if (callbacks.onAddCategory) {
        callbacks.onAddCategory({ name, type, icon, color });
      }
      closeCategoryModal();
    });
  }

  // 4. Delegar exclusão de Categoria
  const categoriesSettingsContainer = document.getElementById('settings-categories-container');
  if (categoriesSettingsContainer) {
    categoriesSettingsContainer.addEventListener('click', (e) => {
      const btnDelete = e.target.closest('.btn-delete-category');
      if (btnDelete) {
        const catId = btnDelete.getAttribute('data-id');
        const nameVal = document.getElementById(`cat-edit-${catId}-name`)?.value || catId;
        if (confirm(`Deseja realmente excluir a categoria "${nameVal}"?`)) {
          if (callbacks.onDeleteCategory) {
            callbacks.onDeleteCategory(catId);
          }
        }
      }
    });
  }

  // ==========================================
  // GERENCIAMENTO DE FORMAS DE PAGAMENTO
  // ==========================================

  // 1. Alternar Modo de Edição de Formas de Pagamento
  const btnToggleEditPayments = document.getElementById('btn-toggle-edit-payments');
  if (btnToggleEditPayments) {
    btnToggleEditPayments.addEventListener('click', () => {
      isEditingPayments = !isEditingPayments;
      
      const formEl = document.getElementById('form-settings-payments');
      const containerEl = document.getElementById('payments-list-container');
      const btnIcon = document.getElementById('edit-payments-btn-icon');
      
      if (isEditingPayments) {
        if (formEl) formEl.classList.remove('hidden');
        if (containerEl) containerEl.classList.add('hidden');
        btnToggleEditPayments.className = 'btn btn-primary';
        btnToggleEditPayments.title = 'Concluir';
        if (btnIcon) btnIcon.setAttribute('data-lucide', 'check-circle');
      } else {
        if (formEl) formEl.classList.add('hidden');
        if (containerEl) containerEl.classList.remove('hidden');
        btnToggleEditPayments.className = 'btn btn-secondary';
        btnToggleEditPayments.title = 'Personalizar';
        if (btnIcon) btnIcon.setAttribute('data-lucide', 'settings');
      }
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  }

  // 2. Salvar Alterações de Formas de Pagamento
  const formSettingsPayments = document.getElementById('form-settings-payments');
  if (formSettingsPayments) {
    formSettingsPayments.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const payRows = document.querySelectorAll('#settings-payments-container .settings-edit-row');
      const updatedConfigs = {};
      
      payRows.forEach(row => {
        const payId = row.getAttribute('data-id');
        const nameVal = document.getElementById(`pay-edit-${payId}-name`).value;
        const iconVal = document.getElementById(`pay-edit-${payId}-icon`).value;
        const colorVal = document.getElementById(`pay-edit-${payId}-color`).value;
        
        updatedConfigs[`${payId}_nome`] = nameVal;
        updatedConfigs[`${payId}_icon`] = iconVal;
        updatedConfigs[`${payId}_color`] = colorVal;
      });

      if (callbacks.onSavePayments) {
        callbacks.onSavePayments(updatedConfigs);
      }

      // Concluir edição
      isEditingPayments = false;
      const formEl = document.getElementById('form-settings-payments');
      const containerEl = document.getElementById('payments-list-container');
      const btnToggle = document.getElementById('btn-toggle-edit-payments');
      const btnIcon = document.getElementById('edit-payments-btn-icon');
      
      if (formEl) formEl.classList.add('hidden');
      if (containerEl) containerEl.classList.remove('hidden');
      if (btnToggle) {
        btnToggle.className = 'btn btn-secondary';
        btnToggle.title = 'Personalizar';
      }
      if (btnIcon) btnIcon.setAttribute('data-lucide', 'settings');
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });
  }

  // 3. Controlar Modal de Cadastro de Forma de Pagamento
  const paymentModal = document.getElementById('modal-add-payment');
  const btnShowAddPayment = document.getElementById('btn-show-add-payment');
  const btnClosePaymentModal = document.getElementById('btn-close-payment-modal');
  const btnCancelPaymentModal = document.getElementById('btn-cancel-payment-modal');
  const formAddPayment = document.getElementById('form-add-payment');

  const openPaymentModal = () => {
    if (paymentModal) paymentModal.classList.remove('hidden');
  };

  const closePaymentModal = () => {
    if (formAddPayment) {
      formAddPayment.reset();
      // Visually reset custom picker
      const triggerIcon = document.getElementById('pay-add-icon-trigger')?.querySelector('i');
      if (triggerIcon) triggerIcon.setAttribute('data-lucide', 'wallet');
      const triggerLabel = document.getElementById('pay-add-icon-label');
      if (triggerLabel) triggerLabel.textContent = 'Carteira (Padrão)';
      const popover = document.getElementById('pay-add-icon-popover');
      if (popover) {
        popover.querySelectorAll('.btn-picker-option').forEach(opt => {
          if (opt.getAttribute('data-value') === 'wallet') opt.classList.add('active');
          else opt.classList.remove('active');
        });
      }
      if (window.lucide) window.lucide.createIcons();
    }
    if (paymentModal) paymentModal.classList.add('hidden');
  };

  if (btnShowAddPayment) btnShowAddPayment.addEventListener('click', openPaymentModal);
  if (btnClosePaymentModal) btnClosePaymentModal.addEventListener('click', closePaymentModal);
  if (btnCancelPaymentModal) btnCancelPaymentModal.addEventListener('click', closePaymentModal);
  if (paymentModal) {
    paymentModal.addEventListener('click', (e) => {
      if (e.target === paymentModal) closePaymentModal();
    });
  }

  if (formAddPayment) {
    formAddPayment.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('pay-name').value;
      const icon = document.getElementById('pay-icon').value;
      const color = document.getElementById('pay-color').value;

      if (callbacks.onAddPayment) {
        callbacks.onAddPayment({ name, icon, color });
      }
      closePaymentModal();
    });
  }

  // 4. Delegar exclusão de Forma de Pagamento
  const paymentsSettingsContainer = document.getElementById('settings-payments-container');
  if (paymentsSettingsContainer) {
    paymentsSettingsContainer.addEventListener('click', (e) => {
      const btnDelete = e.target.closest('.btn-delete-payment');
      if (btnDelete) {
        const payId = btnDelete.getAttribute('data-id');
        const nameVal = document.getElementById(`pay-edit-${payId}-name`)?.value || payId;
        if (confirm(`Deseja realmente excluir a forma de pagamento "${nameVal}"?`)) {
          if (callbacks.onDeletePayment) {
            callbacks.onDeletePayment(payId);
          }
        }
      }
    });
  }

  // 9. Controlar Expansão do Menu Flutuante para Perfil
  const headerNav = document.querySelector('.header-nav');
  const btnProfile = document.getElementById('btn-profile');
  const btnCloseNavProfile = document.getElementById('btn-close-nav-profile');
  const btnLogoutNav = document.querySelector('.btn-logout-nav');

  const expandNavMenu = () => {
    if (headerNav) headerNav.classList.add('expanded');
  };

  const collapseNavMenu = () => {
    if (headerNav) headerNav.classList.remove('expanded');
  };

  if (btnProfile) {
    btnProfile.addEventListener('click', (e) => {
      e.stopPropagation(); // Evita fechar imediatamente ao propagar para document
      if (headerNav) {
        if (headerNav.classList.contains('expanded')) {
          collapseNavMenu();
        } else {
          expandNavMenu();
        }
      }
    });
  }

  if (btnCloseNavProfile) {
    btnCloseNavProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseNavMenu();
    });
  }

  if (btnLogoutNav) {
    btnLogoutNav.addEventListener('click', () => {
      collapseNavMenu();
    });
  }

  // Fechar ao clicar fora do menu
  document.addEventListener('click', (e) => {
    if (headerNav && headerNav.classList.contains('expanded')) {
      if (!headerNav.contains(e.target) && e.target !== btnProfile) {
        collapseNavMenu();
      }
    }
  });

  // 10. Controlar Modal de Edição de Perfil
  const profileModal = document.getElementById('modal-edit-profile');
  const btnEditProfile = document.getElementById('btn-edit-profile');
  const btnCloseProfileModal = document.getElementById('btn-close-profile-modal');
  const btnCancelProfileModal = document.getElementById('btn-cancel-profile-modal');
  const formEditProfile = document.getElementById('form-edit-profile');

  let chosenAvatarUrl = '';

  const btnUseGoogleAvatar = document.getElementById('btn-use-google-avatar');
  if (btnUseGoogleAvatar) {
    btnUseGoogleAvatar.addEventListener('click', async () => {
      const savedUserStr = localStorage.getItem('controlator_user_info');
      if (savedUserStr) {
        try {
          const authUser = JSON.parse(savedUserStr);
          if (authUser.avatar) {
            chosenAvatarUrl = authUser.avatar;
            // Limpar o input de arquivo local para evitar conflito
            const fileInput = document.getElementById('profile-edit-avatar-file');
            if (fileInput) fileInput.value = '';
            
            if (callbacks.onSelectGoogleAvatar) {
              await callbacks.onSelectGoogleAvatar(authUser.avatar);
            } else {
              showToast('Foto do Google selecionada!', 'success');
            }
            
            btnUseGoogleAvatar.innerText = 'Selecionada';
            btnUseGoogleAvatar.className = 'btn btn-primary';
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
  }

  const fileInputFile = document.getElementById('profile-edit-avatar-file');
  if (fileInputFile) {
    fileInputFile.addEventListener('change', () => {
      if (fileInputFile.files && fileInputFile.files.length > 0) {
        // Se escolheu arquivo local, reseta a escolha do Google
        chosenAvatarUrl = '';
        if (btnUseGoogleAvatar) {
          btnUseGoogleAvatar.innerText = 'Usar esta';
          btnUseGoogleAvatar.className = 'btn btn-secondary';
        }
      }
    });
  }

  const openProfileModal = () => {
    const savedUserStr = localStorage.getItem('controlator_user_info');
    const customUserStr = localStorage.getItem('controlator_custom_user_info');
    let activeUser = savedUserStr ? JSON.parse(savedUserStr) : { name: '', avatar: '' };
    if (customUserStr) {
      try {
        activeUser = { ...activeUser, ...JSON.parse(customUserStr) };
      } catch (e) {
        console.error('Erro ao ler customização:', e);
      }
    }

    const nameInput = document.getElementById('profile-edit-name');
    if (nameInput) nameInput.value = activeUser.name || '';
    
    chosenAvatarUrl = activeUser.avatar || '';

    // Configurar opção da foto do Google se disponível
    const googleOptionContainer = document.getElementById('google-avatar-option-container');
    const googlePreviewImg = document.getElementById('google-avatar-preview');
    if (savedUserStr) {
      try {
        const authUser = JSON.parse(savedUserStr);
        if (authUser.avatar) {
          if (googlePreviewImg) googlePreviewImg.src = authUser.avatar;
          if (googleOptionContainer) {
            googleOptionContainer.classList.remove('hidden');
            googleOptionContainer.style.display = 'flex'; // Garantir display flex
          }
          
          if (btnUseGoogleAvatar) {
            if (chosenAvatarUrl === authUser.avatar) {
              btnUseGoogleAvatar.innerText = 'Selecionada';
              btnUseGoogleAvatar.className = 'btn btn-primary';
            } else {
              btnUseGoogleAvatar.innerText = 'Usar esta';
              btnUseGoogleAvatar.className = 'btn btn-secondary';
            }
          }
        } else {
          if (googleOptionContainer) googleOptionContainer.style.display = 'none';
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      if (googleOptionContainer) googleOptionContainer.style.display = 'none';
    }
    
    profileModal.classList.remove('hidden');
    // Forçar atualização do Lucide no modal recém-exibido
    if (window.lucide) {
      window.lucide.createIcons();
    }
  };

  const closeProfileModal = () => {
    formEditProfile.reset();
    profileModal.classList.add('hidden');
  };

  if (btnEditProfile) {
    btnEditProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseNavMenu();
      openProfileModal();
    });
  }
  if (btnCloseProfileModal) btnCloseProfileModal.addEventListener('click', closeProfileModal);
  if (btnCancelProfileModal) btnCancelProfileModal.addEventListener('click', closeProfileModal);

  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) closeProfileModal();
  });

  formEditProfile.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('profile-edit-name').value;
    
    // Processar arquivo de imagem se selecionado
    const fileInput = document.getElementById('profile-edit-avatar-file');
    let avatar = chosenAvatarUrl;

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      try {
        showLoading('Processando imagem do perfil...');
        avatar = await redimensionarImagem(fileInput.files[0]);
      } catch (err) {
        console.error('Erro ao redimensionar imagem:', err);
        showToast('Falha ao processar a imagem: ' + err.message, 'error');
        hideLoading();
        return;
      } finally {
        hideLoading();
      }
    }

    if (callbacks.onSaveProfile) {
      await callbacks.onSaveProfile({ name, avatar });
    } else {
      const customInfo = { name, avatar };
      localStorage.setItem('controlator_custom_user_info', JSON.stringify(customInfo));
      const savedUserStr = localStorage.getItem('controlator_user_info');
      const authUser = savedUserStr ? JSON.parse(savedUserStr) : { name: 'Usuário', avatar: '' };
      updateUserInfo(authUser);
    }
    
    // Limpar o input de arquivo
    if (fileInput) fileInput.value = '';
    
    closeProfileModal();
  });

  const btnSwitchGoogleAccount = document.getElementById('btn-switch-google-account');
  if (btnSwitchGoogleAccount) {
    btnSwitchGoogleAccount.addEventListener('click', () => {
      closeProfileModal();
      if (callbacks.onSwitchAccount) {
        callbacks.onSwitchAccount();
      }
    });
  }

  const btnOpenSettings = document.getElementById('btn-open-settings');
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseNavMenu();
      
      // Remover active de todos os links e panes
      navLinks.forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      // Exibir aba de configurações
      const settingsTab = document.getElementById('tab-settings');
      if (settingsTab) settingsTab.classList.add('active');
    });
  }

  // 11. Controlar Tema (Claro / Escuro)
  const applyTheme = (theme) => {
    const iconEl = document.getElementById('theme-btn-icon');
    const textEl = document.getElementById('theme-btn-text');
    
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      if (iconEl) iconEl.setAttribute('data-lucide', 'moon');
      if (textEl) textEl.innerText = 'Tema Escuro';
    } else {
      document.body.classList.remove('light-theme');
      if (iconEl) iconEl.setAttribute('data-lucide', 'sun');
      if (textEl) textEl.innerText = 'Tema Claro';
    }
    
    localStorage.setItem('controlator_theme', theme);
    
    if (window.lucide) {
      window.lucide.createIcons();
    }

    if (callbacks.onThemeChange) {
      callbacks.onThemeChange();
    }
  };

  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentTheme = localStorage.getItem('controlator_theme') || 'dark';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      collapseNavMenu();
    });
  }

  // Inicializar tema no carregamento
  const initialTheme = localStorage.getItem('controlator_theme') || 'dark';
  applyTheme(initialTheme);

  // ==========================================================
  // CONFIGURAÇÕES E EVENTOS DA IA DO GEMINI E UPLOAD DE PDF (NOVO)
  // ==========================================================
  
  // 12. Visualização e Salvamento da Chave de API do Gemini nos Ajustes
  const geminiKeyInput = document.getElementById('settings-gemini-key');
  const btnSaveGeminiKey = document.getElementById('btn-save-gemini-key');
  const btnToggleGeminiKeyVisibility = document.getElementById('btn-toggle-gemini-key-visibility');

  if (geminiKeyInput) {
    const savedKey = localStorage.getItem('controlator_gemini_key') || '';
    geminiKeyInput.value = savedKey;
  }

  if (btnSaveGeminiKey && geminiKeyInput) {
    btnSaveGeminiKey.addEventListener('click', () => {
      const key = geminiKeyInput.value.trim();
      if (callbacks.onSaveGeminiKey) {
        callbacks.onSaveGeminiKey(key);
      }
    });
  }

  if (btnToggleGeminiKeyVisibility && geminiKeyInput) {
    btnToggleGeminiKeyVisibility.addEventListener('click', () => {
      const isPassword = geminiKeyInput.getAttribute('type') === 'password';
      geminiKeyInput.setAttribute('type', isPassword ? 'text' : 'password');
      
      const iconEl = btnToggleGeminiKeyVisibility.querySelector('i');
      if (iconEl) {
        iconEl.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    });
  }

  // 13. Controle do Modal de Importação de Fatura PDF
  const importModal = document.getElementById('modal-import-invoice');
  const btnImportInvoice = document.getElementById('btn-import-invoice');
  const btnCloseImportModal = document.getElementById('btn-close-import-modal');
  const btnCancelImport = document.getElementById('btn-cancel-import');
  const btnProcessInvoice = document.getElementById('btn-process-invoice');
  const btnBackToUpload = document.getElementById('btn-back-to-upload');
  const btnSaveImported = document.getElementById('btn-save-imported');

  const dropZone = document.getElementById('drop-zone');
  const fileInputPdf = document.getElementById('file-input-pdf');
  const btnBrowseFile = document.getElementById('btn-browse-file');
  const selectedFileInfo = document.getElementById('selected-file-info');
  const selectedFileName = document.getElementById('selected-file-name');
  const selectedFileSize = document.getElementById('selected-file-size');

  let selectedFile = null;

  const showImportStep = (stepName) => {
    document.querySelectorAll('.import-step').forEach(step => step.classList.add('hidden'));
    const stepEl = document.getElementById(`import-step-${stepName}`);
    if (stepEl) stepEl.classList.remove('hidden');
  };

  const openImportModal = () => {
    selectedFile = null;
    if (fileInputPdf) fileInputPdf.value = '';
    if (selectedFileInfo) selectedFileInfo.classList.add('hidden');
    if (btnProcessInvoice) btnProcessInvoice.setAttribute('disabled', 'true');
    if (dropZone) dropZone.classList.remove('dragover');
    
    // Popular o select de contas de destino
    const importAccountTarget = document.getElementById('import-account-target');
    const txAccountSelect = document.getElementById('tx-account');
    if (importAccountTarget && txAccountSelect) {
      importAccountTarget.innerHTML = txAccountSelect.innerHTML;
    }

    showImportStep('upload');
    if (importModal) importModal.classList.remove('hidden');
    if (window.lucide) {
      window.lucide.createIcons();
    }
  };

  const closeImportModal = () => {
    if (importModal) importModal.classList.add('hidden');
  };

  if (btnImportInvoice) btnImportInvoice.addEventListener('click', openImportModal);
  if (btnCloseImportModal) btnCloseImportModal.addEventListener('click', closeImportModal);
  if (btnCancelImport) btnCancelImport.addEventListener('click', closeImportModal);
  if (btnBackToUpload) btnBackToUpload.addEventListener('click', () => showImportStep('upload'));

  if (importModal) {
    importModal.addEventListener('click', (e) => {
      const loadingEl = document.getElementById('import-step-loading');
      const isLoadingStep = loadingEl && !loadingEl.classList.contains('hidden');
      if (e.target === importModal && !isLoadingStep) {
        closeImportModal();
      }
    });
  }

  // Eventos de Drag & Drop
  const handleFileSelection = (file) => {
    if (file && file.type === 'application/pdf') {
      selectedFile = file;
      if (selectedFileName) selectedFileName.innerText = file.name;
      
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      if (selectedFileSize) selectedFileSize.innerText = `(${sizeMB} MB)`;
      
      if (selectedFileInfo) selectedFileInfo.classList.remove('hidden');
      if (btnProcessInvoice) btnProcessInvoice.removeAttribute('disabled');
    } else {
      showToast('Por favor, envie apenas faturas em formato PDF.', 'warning');
      selectedFile = null;
      if (selectedFileInfo) selectedFileInfo.classList.add('hidden');
      if (btnProcessInvoice) btnProcessInvoice.setAttribute('disabled', 'true');
    }
  };

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    if (btnBrowseFile && fileInputPdf) {
      btnBrowseFile.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInputPdf.click();
      });
    }

    fileInputPdf.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });
  }

  if (btnProcessInvoice) {
    btnProcessInvoice.addEventListener('click', async () => {
      if (!selectedFile) return;
      
      const apiKey = localStorage.getItem('controlator_gemini_key');
      if (!apiKey) {
        showToast('Por favor, cadastre sua chave de API do Gemini nos Ajustes antes de processar faturas.', 'warning');
        closeImportModal();
        
        // Redirecionar para Ajustes
        const navLinksList = document.querySelectorAll('.nav-link');
        navLinksList.forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const settingsTab = document.getElementById('tab-settings');
        if (settingsTab) settingsTab.classList.add('active');
        return;
      }

      showImportStep('loading');

      if (callbacks.onProcessInvoiceFile) {
        try {
          await callbacks.onProcessInvoiceFile(selectedFile, apiKey);
        } catch (error) {
          showToast(error.message || 'Falha ao processar o documento.', 'error');
          showImportStep('upload');
        }
      }
    });
  }

  if (btnSaveImported) {
    btnSaveImported.addEventListener('click', () => {
      const selectedTxs = [];
      const rows = document.querySelectorAll('#imported-transactions-body tr');
      const targetAccount = document.getElementById('import-account-target').value;

      rows.forEach(row => {
        const checkbox = row.querySelector('.tx-import-check');
        if (checkbox && checkbox.checked) {
          const date = row.querySelector('.tx-import-date').value;
          const description = row.querySelector('.tx-import-desc').value;
          const category = row.querySelector('.tx-import-cat').value;
          const valInput = row.querySelector('.tx-import-val');
          const value = valInput ? Math.abs(parseFloat(valInput.value) || 0) : 0;
          const type = row.querySelector('.tx-import-type').value;

          if (value > 0) {
            selectedTxs.push({
              date,
              description,
              category,
              value,
              type,
              account: targetAccount
            });
          }
        }
      });

      if (selectedTxs.length === 0) {
        showToast('Nenhuma transação selecionada para importação.', 'warning');
        return;
      }

      if (callbacks.onConfirmImport) {
        callbacks.onConfirmImport(selectedTxs);
        closeImportModal();
      }
    });
  }

  // 14. Eventos do Seletor de Período no Dashboard
  const storedPeriod = localStorage.getItem('controlator_dashboard_period') || 'mensal';
  const periodButtons = document.querySelectorAll('#tab-dashboard .period-selector-container .btn-period');
  periodButtons.forEach(btn => {
    if (btn.getAttribute('data-period') === storedPeriod) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    btn.addEventListener('click', () => {
      periodButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      localStorage.setItem('controlator_dashboard_period', btn.getAttribute('data-period'));
      if (callbacks.onPeriodChange) {
        callbacks.onPeriodChange();
      }
    });
  });



  // 15. Controlar Modal de Salário Recorrente
  const salaryModal = document.getElementById('modal-recurring-salary');
  const btnAddSalary = document.getElementById('btn-add-salary');
  const btnCloseSalaryModal = document.getElementById('btn-close-salary-modal');
  const btnCancelSalaryModal = document.getElementById('btn-cancel-salary-modal');
  const formSalary = document.getElementById('form-recurring-salary');

  const openSalaryModal = () => {
    const dateInput = document.getElementById('sal-start-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    const salAccountSelect = document.getElementById('sal-account');
    const txAccountSelect = document.getElementById('tx-account');
    
    if (salAccountSelect && txAccountSelect) {
      salAccountSelect.innerHTML = txAccountSelect.innerHTML;
    }
    
    if (salaryModal) {
      salaryModal.classList.remove('hidden');
    }
    
    if (window.lucide) {
      window.lucide.createIcons();
    }
  };

  const closeSalaryModal = () => {
    if (formSalary) formSalary.reset();
    if (salaryModal) salaryModal.classList.add('hidden');
  };

  if (btnAddSalary) {
    btnAddSalary.addEventListener('click', () => {
      openSalaryModal();
    });
  }
  if (btnCloseSalaryModal) btnCloseSalaryModal.addEventListener('click', closeSalaryModal);
  if (btnCancelSalaryModal) btnCancelSalaryModal.addEventListener('click', closeSalaryModal);

  if (salaryModal) {
    salaryModal.addEventListener('click', (e) => {
      if (e.target === salaryModal) closeSalaryModal();
    });
  }

  if (formSalary) {
    formSalary.addEventListener('submit', (e) => {
      e.preventDefault();
      const startDate = document.getElementById('sal-start-date').value;
      const frequency = document.getElementById('sal-frequency').value;
      const value = Math.abs(parseFloat(document.getElementById('sal-value').value));
      const occurrences = parseInt(document.getElementById('sal-occurrences').value, 10);
      const account = document.getElementById('sal-account').value;
      const description = document.getElementById('sal-description').value;

      if (callbacks.onAddRecurringSalary) {
        callbacks.onAddRecurringSalary({ startDate, frequency, value, occurrences, account, description });
      }
      closeSalaryModal();
    });
  }

  // 16. Ouvintes dos Seletores de Subperíodo do Dashboard
  const dashboardYearSelector  = document.getElementById('dashboard-year-selector');
  const dashboardMonthInput    = document.getElementById('dashboard-month-input');
  const dashboardWeekInput     = document.getElementById('dashboard-week-input');
  const dashboardDayInput      = document.getElementById('dashboard-day-input');

  // Inicializar inputs com a data de hoje / mês atual
  const _now = new Date();
  const _todayStr  = _now.getFullYear() + '-' + String(_now.getMonth() + 1).padStart(2, '0') + '-' + String(_now.getDate()).padStart(2, '0');
  const _monthStr  = _now.getFullYear() + '-' + String(_now.getMonth() + 1).padStart(2, '0');
  if (dashboardMonthInput && !dashboardMonthInput.value) dashboardMonthInput.value = _monthStr;
  if (dashboardWeekInput  && !dashboardWeekInput.value)  dashboardWeekInput.value  = _todayStr;
  if (dashboardDayInput   && !dashboardDayInput.value)   dashboardDayInput.value   = _todayStr;

  [dashboardYearSelector, dashboardMonthInput, dashboardWeekInput, dashboardDayInput].forEach(el => {
    if (!el) return;
    el.addEventListener('change', () => {
      if (callbacks.onPeriodChange) callbacks.onPeriodChange();
    });
  });

  // 17. Ouvinte do Seletor de Modo de Visualização do Gráfico de Evolução
  const evolutionViewModeSelector = document.getElementById('evolution-view-mode-selector');
  if (evolutionViewModeSelector) {
    const storedViewMode = localStorage.getItem('controlator_evolution_view_mode') || 'atual';
    evolutionViewModeSelector.value = storedViewMode;
    evolutionViewModeSelector.addEventListener('change', () => {
      localStorage.setItem('controlator_evolution_view_mode', evolutionViewModeSelector.value);
      if (callbacks.onPeriodChange) {
        callbacks.onPeriodChange();
      }
    });
  }

  // 18. Ouvinte e delegação global para Custom Icon Pickers
  document.addEventListener('click', (e) => {
    // A) Clicou no botão de disparo (Trigger)
    const trigger = e.target.closest('.btn-picker-trigger');
    if (trigger) {
      e.stopPropagation();
      const picker = trigger.closest('.custom-icon-picker');
      if (picker) {
        const popover = picker.querySelector('.picker-popover');
        
        // Fechar qualquer outro popover aberto no momento
        document.querySelectorAll('.picker-popover').forEach(p => {
          if (p !== popover) p.classList.add('hidden');
        });

        if (popover) {
          popover.classList.toggle('hidden');
        }
      }
      return;
    }

    // B) Clicou em uma opção de ícone (Option)
    const optionBtn = e.target.closest('.btn-picker-option');
    if (optionBtn) {
      e.stopPropagation();
      const picker = optionBtn.closest('.custom-icon-picker');
      if (picker) {
        const val = optionBtn.getAttribute('data-value');
        const hiddenInput = picker.querySelector('input[type="hidden"]');
        if (hiddenInput) {
          hiddenInput.value = val;
          hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Atualizar o trigger visualmente
        const triggerBtn = picker.querySelector('.btn-picker-trigger');
        if (triggerBtn) {
          const iconEl = triggerBtn.querySelector('i');
          if (iconEl) {
            iconEl.setAttribute('data-lucide', val);
          }
          const labelEl = triggerBtn.querySelector('span');
          if (labelEl) {
            const title = optionBtn.getAttribute('title') || val;
            labelEl.textContent = title;
          }
        }

        // Atualizar a classe active entre as opções
        picker.querySelectorAll('.btn-picker-option').forEach(opt => {
          opt.classList.remove('active');
        });
        optionBtn.classList.add('active');

        // Fechar o popover
        const popover = picker.querySelector('.picker-popover');
        if (popover) {
          popover.classList.add('hidden');
        }

        // Recriar os ícones do Lucide na página para aplicar o novo ícone
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
      return;
    }

    // C) Clicou em qualquer outro lugar: fechar todos os popovers de ícones
    document.querySelectorAll('.picker-popover').forEach(p => {
      p.classList.add('hidden');
    });
  });
}

// Helpers para exibir / ocultar loading
export function showLoading(text = 'Aguarde...') {
  document.getElementById('loading-text').innerText = text;
  document.getElementById('global-loading').classList.remove('hidden');
}

export function hideLoading() {
  document.getElementById('global-loading').classList.add('hidden');
}

// Atualizar cabeçalho do perfil do usuário e menu flutuante de perfil
export function updateUserInfo(userInfo) {
  const customUserStr = localStorage.getItem('controlator_custom_user_info');
  if (customUserStr && userInfo) {
    try {
      const customInfo = JSON.parse(customUserStr);
      userInfo = { ...userInfo, ...customInfo };
    } catch (e) {
      console.error('Erro ao ler customização de perfil:', e);
    }
  }

  const avatarEl = document.getElementById('user-avatar');
  const initialEl = document.getElementById('user-initial');
  
  const navProfileAvatar = document.getElementById('nav-profile-avatar');
  const navProfileInitial = document.getElementById('nav-profile-initial');
  const navProfileName = document.getElementById('nav-profile-name');
  const welcomeMsg = document.getElementById('welcome-message');

  if (userInfo) {
    const firstLetter = userInfo.name ? userInfo.name.trim().charAt(0) : 'U';
    
    // Configurar iniciais
    if (initialEl) {
      initialEl.innerText = firstLetter;
    }
    if (navProfileInitial) {
      navProfileInitial.innerText = firstLetter;
    }
    
    // Configurar nome na gaveta do menu
    if (navProfileName) {
      navProfileName.innerText = userInfo.name;
    }

    // Configurar mensagem de boas-vindas no painel (apenas Olá, Primeiro Nome)
    if (welcomeMsg) {
      const firstName = userInfo.name ? userInfo.name.trim().split(' ')[0] : 'Usuário';
      welcomeMsg.innerText = `Olá, ${firstName}`;
    }

    // Configurar avatares
    if (userInfo.avatar) {
      if (avatarEl) {
        avatarEl.src = userInfo.avatar;
        avatarEl.classList.remove('hidden');
      }
      if (initialEl) {
        initialEl.classList.add('hidden');
      }
      
      if (navProfileAvatar) {
        navProfileAvatar.src = userInfo.avatar;
        navProfileAvatar.classList.remove('hidden');
      }
      if (navProfileInitial) {
        navProfileInitial.classList.add('hidden');
      }
    } else {
      if (avatarEl) {
        avatarEl.classList.add('hidden');
      }
      if (initialEl) {
        initialEl.classList.remove('hidden');
      }
      
      if (navProfileAvatar) {
        navProfileAvatar.src = '';
        navProfileAvatar.classList.add('hidden');
      }
      if (navProfileInitial) {
        navProfileInitial.classList.remove('hidden');
      }
    }
  } else {
    // Resetar
    if (avatarEl) avatarEl.classList.add('hidden');
    if (initialEl) {
      initialEl.innerText = 'U';
      initialEl.classList.remove('hidden');
    }
    
    if (navProfileAvatar) {
      navProfileAvatar.src = '';
      navProfileAvatar.classList.add('hidden');
    }
    if (navProfileInitial) {
      navProfileInitial.innerText = 'U';
      navProfileInitial.classList.remove('hidden');
    }
    if (navProfileName) {
      navProfileName.innerText = 'Desconectado';
    }
    if (welcomeMsg) {
      welcomeMsg.innerText = 'Olá, Usuário';
    }
  }
}

// Formatação monetária BRL
export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Função para calcular gastos de um cartão com base no ciclo de faturamento
function getBillingCycleSum(transactions, cardName, closingDay) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  
  let cycleStart, cycleEnd;
  const todayDay = now.getDate();
  const closingDayNum = Number(closingDay) || 5;

  if (todayDay > closingDayNum) {
    cycleStart = new Date(currentYear, currentMonth, closingDayNum + 1);
    cycleEnd = new Date(currentYear, currentMonth + 1, closingDayNum);
  } else {
    cycleStart = new Date(currentYear, currentMonth - 1, closingDayNum + 1);
    cycleEnd = new Date(currentYear, currentMonth, closingDayNum);
  }
  
  // Setar meio-dia para evitar variações de fuso horário local
  cycleStart.setHours(0, 0, 0, 0);
  cycleEnd.setHours(23, 59, 59, 999);

  return transactions
    .filter(tx => {
      if (tx.type !== 'Despesa' || tx.account !== cardName) return false;
      const txDate = new Date(tx.date + 'T12:00:00');
      return txDate >= cycleStart && txDate <= cycleEnd;
    })
    .reduce((sum, tx) => sum + tx.value, 0);
}

// Helper para obter as semanas do ano (Segunda a Domingo)
function obterSemanasDoAno(ano) {
  const semanas = [];
  const data = new Date(ano, 0, 1);
  const diaSemana = data.getDay(); // 0 = Dom, 1 = Seg, ...
  const diferenca = diaSemana === 0 ? -6 : 1 - diaSemana;
  data.setDate(data.getDate() + diferenca); // Segunda-feira daquela semana
  
  let numSemana = 1;
  while (data.getFullYear() <= ano || (data.getFullYear() === ano + 1 && data.getMonth() === 0 && data.getDate() < 7)) {
    const segunda = new Date(data);
    const domingo = new Date(data);
    domingo.setDate(data.getDate() + 6);
    
    if (segunda.getFullYear() > ano) break;
    
    const label = `Semana ${String(numSemana).padStart(2, '0')} (${segunda.getDate().toString().padStart(2, '0')}/${(segunda.getMonth() + 1).toString().padStart(2, '0')} a ${domingo.getDate().toString().padStart(2, '0')}/${(domingo.getMonth() + 1).toString().padStart(2, '0')})`;
    const valor = segunda.toISOString().split('T')[0];
    
    semanas.push({ label, valor });
    
    data.setDate(data.getDate() + 7);
    numSemana++;
  }
  return semanas;
}

// Helper para obter todos os dias do mês
function obterDiasDoMes(ano, mes) {
  const dias = [];
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  for (let i = 1; i <= totalDias; i++) {
    const data = new Date(ano, mes, i);
    const dStr = data.getFullYear() + '-' + String(data.getMonth() + 1).padStart(2, '0') + '-' + String(data.getDate()).padStart(2, '0');
    const diaSemanaLabel = diasSemana[data.getDay()];
    const label = `${String(i).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano} (${diaSemanaLabel})`;
    
    dias.push({ label, valor: dStr });
  }
  return dias;
}

// Atualiza o painel principal Dashboard
export function updateDashboard(transactions, configs) {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Obter período ativo e modo de visualização
  const activePeriod = localStorage.getItem('controlator_dashboard_period') || 'mensal';
  const viewMode = localStorage.getItem('controlator_evolution_view_mode') || 'atual';

  // Obter seletores de subperíodo
  const dashboardYearSelector  = document.getElementById('dashboard-year-selector');
  const dashboardMonthInput    = document.getElementById('dashboard-month-input');
  const dashboardWeekInput     = document.getElementById('dashboard-week-input');
  const dashboardDayInput      = document.getElementById('dashboard-day-input');

  // 1. Popular o seletor de ano se ainda não foi preenchido
  if (dashboardYearSelector && dashboardYearSelector.options.length === 0) {
    const yearsSet = new Set([currentYear]);
    transactions.forEach(tx => {
      const y = new Date(tx.date + 'T12:00:00').getFullYear();
      if (!isNaN(y)) yearsSet.add(y);
    });
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    dashboardYearSelector.innerHTML = sortedYears.map(y => `<option value="${y}">${y}</option>`).join('');
    dashboardYearSelector.value = currentYear;
  }

  // Inicializar inputs nativos com defaults se ainda vazios
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  if (dashboardMonthInput && !dashboardMonthInput.value) dashboardMonthInput.value = monthStr;
  if (dashboardWeekInput  && !dashboardWeekInput.value)  dashboardWeekInput.value  = todayStr;
  if (dashboardDayInput   && !dashboardDayInput.value)   dashboardDayInput.value   = todayStr;

  // 2. Controlar visibilidade dos seletores baseados no período
  const hide = el => el && el.classList.add('hidden');
  const show = el => el && el.classList.remove('hidden');
  hide(dashboardYearSelector); hide(dashboardMonthInput); hide(dashboardWeekInput); hide(dashboardDayInput);
  if (activePeriod === 'anual')   show(dashboardYearSelector);
  if (activePeriod === 'mensal')  show(dashboardMonthInput);
  if (activePeriod === 'semanal') show(dashboardWeekInput);
  if (activePeriod === 'diario')  show(dashboardDayInput);

  // Atualizar as opções do seletor de modo de visualização (atual vs ultimos) no card de evolução
  const evolutionViewModeSelector = document.getElementById('evolution-view-mode-selector');
  if (evolutionViewModeSelector) {
    const optAtual = evolutionViewModeSelector.querySelector('option[value="atual"]');
    const optUltimos = evolutionViewModeSelector.querySelector('option[value="ultimos"]');
    if (optAtual && optUltimos) {
      if (activePeriod === 'diario') {
        optAtual.innerText = 'Dia de Hoje';
        optUltimos.innerText = 'Últimas 24h';
      } else if (activePeriod === 'semanal') {
        optAtual.innerText = 'Semana Atual';
        optUltimos.innerText = 'Últimos 7 dias';
      } else if (activePeriod === 'anual') {
        optAtual.innerText = 'Ano Atual';
        optUltimos.innerText = 'Últimos 12 meses';
      } else {
        optAtual.innerText = 'Mês Atual';
        optUltimos.innerText = 'Últimos 30 dias';
      }
    }
  }

  // Derivar m\u00eas/ano selecionado a partir dos novos inputs nativos
  let currentMonth = now.getMonth();
  let selectedYear  = dashboardYearSelector && dashboardYearSelector.value ? Number(dashboardYearSelector.value) : currentYear;

  if (dashboardMonthInput && dashboardMonthInput.value) {
    const [y, m] = dashboardMonthInput.value.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m)) { selectedYear = y; currentMonth = m - 1; }
  }

  // Obter m\u00eas selecionado para o gr\u00e1fico de categorias
  const selectedMonth = currentMonth;

  // Helper para obter a data/hora exata de uma transação
  function getTxDate(tx) {
    if (tx.id && tx.id.startsWith('tx_')) {
      const parts = tx.id.split('_');
      const ts = Number(parts[1]);
      if (!isNaN(ts) && ts > 0) {
        return new Date(ts);
      }
    }
    return new Date(tx.date + 'T12:00:00');
  }

  // 1. Filtrar transações baseado no período ativo e modo de visualização para os cards de KPI
  let filteredTxs = [];
  let periodSubtitle = '';
  let kpiPeriodLabel = '';
  let positiveBalanceText = '';
  let negativeBalanceText = '';

  // Preparar estruturas para o gráfico de linha de evolução
  let daysLabels = [];
  let cumulativeExpenses = [];

  if (viewMode === 'ultimos') {
    // MODO: Últimos X
    if (activePeriod === 'diario') {
      const oneDayMs = 24 * 60 * 60 * 1000;
      filteredTxs = transactions.filter(tx => {
        const txDate = getTxDate(tx);
        const diff = now.getTime() - txDate.getTime();
        return diff >= 0 && diff <= oneDayMs;
      });
      periodSubtitle = 'Últimas 24 horas';
      kpiPeriodLabel = 'Últimas 24h';
      positiveBalanceText = 'Balanço positivo nas últimas 24h';
      negativeBalanceText = 'Gasto superior ao recebido nas últimas 24h';

      // Gráfico: 24h (de 23h atrás até a hora atual)
      const hourlyExpenses = Array(24).fill(0);
      const startHourTime = new Date(now.getTime() - 23 * 60 * 60 * 1000);
      startHourTime.setMinutes(0, 0, 0); // Alinhar ao início da hora

      for (let i = 0; i < 24; i++) {
        const slotTime = new Date(startHourTime.getTime() + i * 60 * 60 * 1000);
        daysLabels.push(String(slotTime.getHours()).padStart(2, '0') + 'h');
      }

      transactions.forEach(tx => {
        if (tx.type === 'Despesa') {
          const txDate = getTxDate(tx);
          const diff = txDate.getTime() - startHourTime.getTime();
          if (diff >= 0 && diff < 24 * 60 * 60 * 1000) {
            const slotIdx = Math.floor(diff / (60 * 60 * 1000));
            if (slotIdx >= 0 && slotIdx < 24) {
              hourlyExpenses[slotIdx] += tx.value;
            }
          }
        }
      });

      cumulativeExpenses = hourlyExpenses;

    } else if (activePeriod === 'semanal') {
      const last7DaysStr = [];
      const startOf7Days = new Date(now);
      startOf7Days.setDate(now.getDate() - 6);
      startOf7Days.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const d = new Date(startOf7Days);
        d.setDate(startOf7Days.getDate() + i);
        const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        last7DaysStr.push(dStr);
        daysLabels.push(String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'));
      }

      filteredTxs = transactions.filter(tx => last7DaysStr.includes(tx.date));
      periodSubtitle = 'Últimos 7 dias';
      kpiPeriodLabel = 'Últimos 7 dias';
      positiveBalanceText = 'Balanço positivo nos últimos 7 dias';
      negativeBalanceText = 'Gasto superior nos últimos 7 dias';

      const dailyExpenses = Array(7).fill(0);
      transactions.forEach(tx => {
        if (tx.type === 'Despesa') {
          const idx = last7DaysStr.indexOf(tx.date);
          if (idx !== -1) {
            dailyExpenses[idx] += tx.value;
          }
        }
      });

      cumulativeExpenses = dailyExpenses;

    } else if (activePeriod === 'anual') {
      const monthsKeys = [];
      const startMonthDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      for (let i = 0; i < 12; i++) {
        const d = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth() + i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        monthsKeys.push(`${year}-${String(month + 1).padStart(2, '0')}`);

        const labelMonthName = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const capitalizedMonthName = labelMonthName.charAt(0).toUpperCase() + labelMonthName.slice(1);
        daysLabels.push(`${capitalizedMonthName}/${String(year).slice(-2)}`);
      }

      filteredTxs = transactions.filter(tx => {
        const txParts = tx.date.split('-');
        if (txParts.length === 3) {
          return monthsKeys.includes(`${txParts[0]}-${txParts[1]}`);
        }
        return false;
      });
      periodSubtitle = 'Últimos 12 meses';
      kpiPeriodLabel = 'Últimos 12 meses';
      positiveBalanceText = 'Balanço positivo nos últimos 12 meses';
      negativeBalanceText = 'Gasto superior nos últimos 12 meses';

      const monthlyExpenses = Array(12).fill(0);
      transactions.forEach(tx => {
        if (tx.type === 'Despesa') {
          const txParts = tx.date.split('-');
          if (txParts.length === 3) {
            const txYearMonth = `${txParts[0]}-${txParts[1]}`;
            const idx = monthsKeys.indexOf(txYearMonth);
            if (idx !== -1) {
              monthlyExpenses[idx] += tx.value;
            }
          }
        }
      });

      cumulativeExpenses = monthlyExpenses;

    } else {
      // mensal (últimos 30 dias)
      const last30DaysStr = [];
      const startOf30Days = new Date(now);
      startOf30Days.setDate(now.getDate() - 29);
      startOf30Days.setHours(0, 0, 0, 0);

      for (let i = 0; i < 30; i++) {
        const d = new Date(startOf30Days);
        d.setDate(startOf30Days.getDate() + i);
        const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        last30DaysStr.push(dStr);
        daysLabels.push(String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'));
      }

      filteredTxs = transactions.filter(tx => last30DaysStr.includes(tx.date));
      periodSubtitle = 'Últimos 30 dias';
      kpiPeriodLabel = 'Últimos 30 dias';
      positiveBalanceText = 'Balanço positivo nos últimos 30 dias';
      negativeBalanceText = 'Gasto superior nos últimos 30 dias';

      const dailyExpenses = Array(30).fill(0);
      transactions.forEach(tx => {
        if (tx.type === 'Despesa') {
          const idx = last30DaysStr.indexOf(tx.date);
          if (idx !== -1) {
            dailyExpenses[idx] += tx.value;
          }
        }
      });

      cumulativeExpenses = dailyExpenses;
    }

  } else {
    // MODO: Período Atual (Calendário)
    if (activePeriod === 'diario') {
      // Ler a data selecionada do novo input nativo
      const selectedDayStr = (dashboardDayInput && dashboardDayInput.value)
        ? dashboardDayInput.value
        : todayStr;

      const targetDate = new Date(selectedDayStr + 'T12:00:00');
      const formattedDay = targetDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      filteredTxs = transactions.filter(tx => tx.date === selectedDayStr);
      periodSubtitle = `Dia ${formattedDay}`;
      kpiPeriodLabel = formattedDay;
      positiveBalanceText = 'Balanço positivo no dia';
      negativeBalanceText = 'Gasto superior no dia';

      // Gráfico: 24h do dia selecionado (00:00 às 23:00)
      daysLabels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + 'h');
      const hourlyExpenses = Array(24).fill(0);

      transactions.forEach(tx => {
        if (tx.type === 'Despesa' && tx.date === selectedDayStr) {
          const txDate = getTxDate(tx);
          const hour = txDate.getHours();
          if (hour >= 0 && hour < 24) {
            hourlyExpenses[hour] += tx.value;
          }
        }
      });

      cumulativeExpenses = hourlyExpenses;

    } else if (activePeriod === 'semanal') {
      // O usuário escolhe qualquer dia da semana desejada; calculamos Seg a Dom
      const refDate = (dashboardWeekInput && dashboardWeekInput.value)
        ? new Date(dashboardWeekInput.value + 'T12:00:00')
        : now;
      const distToMon = refDate.getDay() === 0 ? 6 : refDate.getDay() - 1;
      const mondayDate = new Date(refDate);
      mondayDate.setDate(refDate.getDate() - distToMon);
      mondayDate.setHours(0, 0, 0, 0);
      const mondayStr = mondayDate.toISOString().split('T')[0];
      const sundayDate = new Date(mondayDate);
      sundayDate.setDate(mondayDate.getDate() + 6);

      const weekDaysStr = [];
      daysLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(mondayDate);
        d.setDate(mondayDate.getDate() + i);
        const dStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        weekDaysStr.push(dStr);
      }

      filteredTxs = transactions.filter(tx => weekDaysStr.includes(tx.date));
      
      const fmtOptions = { day: '2-digit', month: '2-digit' };
      const startFmt = mondayDate.toLocaleDateString('pt-BR', fmtOptions);
      const endFmt = sundayDate.toLocaleDateString('pt-BR', fmtOptions);
      periodSubtitle = `Semana de ${startFmt} a ${endFmt}`;
      kpiPeriodLabel = `Semana (${startFmt} - ${endFmt})`;
      positiveBalanceText = 'Balanço positivo na semana';
      negativeBalanceText = 'Gasto superior na semana';

      const dailyExpenses = Array(7).fill(0);
      transactions.forEach(tx => {
        if (tx.type === 'Despesa') {
          const idx = weekDaysStr.indexOf(tx.date);
          if (idx !== -1) {
            dailyExpenses[idx] += tx.value;
          }
        }
      });

      cumulativeExpenses = dailyExpenses;

    } else if (activePeriod === 'anual') {
      // selectedYear já deriva do dashboardYearSelector no topo da função
      filteredTxs = transactions.filter(tx => {
        const txDate = new Date(tx.date + 'T12:00:00');
        return txDate.getFullYear() === selectedYear;
      });
      periodSubtitle = `Janeiro a Dezembro de ${selectedYear}`;
      kpiPeriodLabel = `Ano (${selectedYear})`;
      positiveBalanceText = `Balanço positivo em ${selectedYear}`;
      negativeBalanceText = `Gasto superior em ${selectedYear}`;

      daysLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthlyExpenses = Array(12).fill(0);
      transactions.forEach(tx => {
        if (tx.type === 'Despesa') {
          const txDate = new Date(tx.date + 'T12:00:00');
          if (txDate.getFullYear() === selectedYear) {
            monthlyExpenses[txDate.getMonth()] += tx.value;
          }
        }
      });

      cumulativeExpenses = monthlyExpenses;

    } else {
      // mensal (Mês vigente)
      filteredTxs = transactions.filter(tx => {
        const txDate = new Date(tx.date + 'T12:00:00');
        return txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth;
      });
      const monthDate = new Date(currentYear, currentMonth, 1);
      const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'long' });
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      periodSubtitle = `Mês de ${capitalizedMonth}`;
      kpiPeriodLabel = capitalizedMonth;
      positiveBalanceText = 'Balanço positivo no mês';
      negativeBalanceText = 'Gasto superior no mês';

      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      daysLabels = Array.from({ length: lastDayOfMonth }, (_, i) => String(i + 1).padStart(2, '0'));
      const dailyExpenses = Array(lastDayOfMonth).fill(0);

      filteredTxs
        .filter(tx => tx.type === 'Despesa')
        .forEach(tx => {
          const txDate = new Date(tx.date + 'T12:00:00');
          const day = txDate.getDate();
          if (day >= 1 && day <= lastDayOfMonth) {
            dailyExpenses[day - 1] += tx.value;
          }
        });

      cumulativeExpenses = dailyExpenses;
    }
  }

  const totalReceived = filteredTxs
    .filter(tx => tx.type === 'Receita')
    .reduce((sum, tx) => sum + tx.value, 0);

  const totalSpent = filteredTxs
    .filter(tx => tx.type === 'Despesa')
    .reduce((sum, tx) => sum + tx.value, 0);

  const totalSaved = filteredTxs
    .filter(tx => tx.type === 'Poupança')
    .reduce((sum, tx) => sum + tx.value, 0);

  const balance = totalReceived - totalSpent - totalSaved;

  // Atualizar rótulos dos KPIs com o período correto
  const receivedLabel = document.getElementById('kpi-received-label');
  const spentLabel = document.getElementById('kpi-spent-label');
  const savedLabel = document.getElementById('kpi-saved-label');
  const balanceLabel = document.getElementById('kpi-balance-label');

  if (receivedLabel) receivedLabel.innerText = `Recebido (${kpiPeriodLabel})`;
  if (spentLabel) spentLabel.innerText = `Gasto (${kpiPeriodLabel})`;
  if (savedLabel) savedLabel.innerText = `Poupado (${kpiPeriodLabel})`;
  if (balanceLabel) balanceLabel.innerText = `Resultado (${kpiPeriodLabel})`;

  // Atualizar DOM dos KPIs
  document.getElementById('kpi-received').innerText = formatBRL(totalReceived);
  document.getElementById('kpi-spent').innerText = formatBRL(totalSpent);
  document.getElementById('kpi-saved').innerText = formatBRL(totalSaved);
  
  const balanceEl = document.getElementById('kpi-balance');
  const balanceIcon = document.getElementById('kpi-balance-icon');
  const balanceFooter = document.getElementById('kpi-balance-footer');
  
  balanceEl.innerText = formatBRL(balance);
  if (balance >= 0) {
    balanceEl.className = 'kpi-value color-success';
    if (balanceIcon) {
      balanceIcon.classList.remove('color-danger', 'color-primary');
      balanceIcon.classList.add('color-success');
      balanceIcon.setAttribute('data-lucide', 'scale');
    }
    if (balanceFooter) balanceFooter.innerText = positiveBalanceText;
  } else {
    balanceEl.className = 'kpi-value color-danger';
    if (balanceIcon) {
      balanceIcon.classList.remove('color-success', 'color-primary');
      balanceIcon.classList.add('color-danger');
      balanceIcon.setAttribute('data-lucide', 'alert-circle');
    }
    if (balanceFooter) balanceFooter.innerText = negativeBalanceText;
  }

  // Re-desenhar ícones Lucide atualizados
  lucide.createIcons();

  // 2. Atualizar Cartões de Crédito Dinamicamente (sempre usando todas as transações, baseado no ciclo atual)
  const cardsContainer = document.getElementById('credit-cards-container');
  if (cardsContainer) {
    cardsContainer.innerHTML = '';
    
    const cardIdsStr = configs['cartoes_lista'];
    const cardIds = cardIdsStr ? cardIdsStr.split(',').filter(id => id.trim() !== '') : [];

    if (cardIds.length === 0) {
      cardsContainer.innerHTML = `<p class="text-muted text-center" style="padding: 20px;">Nenhum cartão cadastrado.</p>`;
    } else {
      // Cores para rotacionar o visual
      const colorStyles = ['purple', 'yellow', 'blue', 'indigo', 'rose', 'emerald'];
      
      cardIds.forEach((id, idx) => {
        const cardName = configs[`${id}_nome`] || id;
        const limit = Number(configs[`${id}_limite`]) || 0;
        const closing = Number(configs[`${id}_fechamento`]) || 5;
        const due = Number(configs[`${id}_vencimento`]) || 15;
        
        const billSum = getBillingCycleSum(transactions, cardName, closing);
        const pct = limit > 0 ? Math.min((billSum / limit) * 100, 100) : 0;
        
        const colorClass = colorStyles[idx % colorStyles.length];
        
        const cardItem = document.createElement('div');
        cardItem.className = `credit-card-item card-${colorClass}`;
        cardItem.innerHTML = `
          <div class="card-item-header">
            <span class="card-brand"><i data-lucide="credit-card" class="${colorClass}-icon"></i> ${cardName}</span>
            <span class="card-dates">Fecha dia ${String(closing).padStart(2, '0')} | Vence dia ${String(due).padStart(2, '0')}</span>
          </div>
          <div class="card-progress-bar-wrapper">
            <div class="card-progress-bar">
              <div class="progress-fill ${colorClass}-fill" style="width: ${pct}%"></div>
            </div>
          </div>
          <div class="card-values">
            <span>Fatura: <strong>${formatBRL(billSum)}</strong></span>
            <span>Limite: <span>${formatBRL(limit)}</span></span>
          </div>
        `;
        cardsContainer.appendChild(cardItem);
      });
      
      // Atualizar ícones recém-criados
      lucide.createIcons();
    }
  }

  // Atualizar mensagens de "sem dados" nos gráficos dinamicamente
  const dailyNoDataEl = document.getElementById('daily-chart-no-data');
  if (dailyNoDataEl) {
    const dailyNoDataTextEl = dailyNoDataEl.querySelector('p');
    if (dailyNoDataTextEl) {
      if (activePeriod === 'diario') {
        dailyNoDataTextEl.innerText = viewMode === 'ultimos' ? 'Nenhuma despesa registrada nas últimas 24 horas.' : 'Nenhuma despesa registrada hoje.';
      } else if (activePeriod === 'semanal') {
        dailyNoDataTextEl.innerText = viewMode === 'ultimos' ? 'Nenhuma despesa registrada nos últimos 7 dias.' : 'Nenhuma despesa registrada nesta semana.';
      } else if (activePeriod === 'anual') {
        dailyNoDataTextEl.innerText = viewMode === 'ultimos' ? 'Nenhuma despesa registrada nos últimos 12 meses.' : 'Nenhuma despesa registrada neste ano.';
      } else {
        dailyNoDataTextEl.innerText = viewMode === 'ultimos' ? 'Nenhuma despesa registrada nos últimos 30 dias.' : 'Nenhuma despesa registrada neste mês.';
      }
    }
  }

  const catNoDataEl = document.getElementById('chart-no-data');
  if (catNoDataEl) {
    const catNoDataTextEl = catNoDataEl.querySelector('p');
    if (catNoDataTextEl) {
      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      const selectedMonthName = monthNames[selectedMonth];
      catNoDataTextEl.innerText = `Nenhuma despesa registrada em ${selectedMonthName}.`;
    }
  }

  // 3. Gerar Gráfico de Pizza de Categorias
  const expensesByCategory = {};
  transactions
    .filter(tx => {
      if (tx.type !== 'Despesa') return false;
      const txDate = new Date(tx.date + 'T12:00:00');
      return txDate.getFullYear() === currentYear && txDate.getMonth() === selectedMonth;
    })
    .forEach(tx => {
      expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + tx.value;
    });

  renderCategoryChart(expensesByCategory);

  // 4. Atualizar legenda de subtítulo do gráfico
  const chartSubtitleEl = document.getElementById('daily-chart-period-subtitle');
  if (chartSubtitleEl) {
    chartSubtitleEl.innerText = periodSubtitle;
  }

  renderDailyChart(cumulativeExpenses, daysLabels);
}

// Desenha ou atualiza o gráfico de pizza de categorias
function renderCategoryChart(dataObj) {
  const ctx = document.getElementById('category-chart');
  const noDataEl = document.getElementById('chart-no-data');
  const categories = Object.keys(dataObj);
  const values = Object.values(dataObj);

  const chartContainer = ctx.parentElement;

  if (categories.length === 0) {
    chartContainer.classList.add('hidden');
    noDataEl.classList.remove('hidden');
    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }
    return;
  }

  chartContainer.classList.remove('hidden');
  noDataEl.classList.add('hidden');

  // Cores correspondentes das categorias
  const categoryColorMap = {
    'Alimentação': '#38bdf8', // Sky Blue
    'Transporte': '#f43f5e', // Rose
    'Moradia': '#a855f7', // Purple
    'Lazer': '#eab308', // Yellow
    'Saúde': '#10b981', // Emerald
    'Outros': '#64748b' // Muted Gray
  };

  const colors = categories.map(cat => categoryColorMap[cat] || '#818cf8');
  const isLightTheme = document.body.classList.contains('light-theme');
  const borderColor = isLightTheme ? '#ffffff' : '#14182b'; // panel-bg equivalent
  const textColor = isLightTheme ? '#475569' : '#94a3b8';

  if (categoryChart) {
    categoryChart.data.labels = categories;
    categoryChart.data.datasets[0].data = values;
    categoryChart.data.datasets[0].backgroundColor = colors;
    categoryChart.data.datasets[0].borderColor = borderColor;
    categoryChart.options.plugins.legend.labels.color = textColor;
    categoryChart.update();
  } else {
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: borderColor
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: textColor,
              font: {
                family: 'Inter',
                size: 11
              },
              padding: 15
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.raw;
                return ` ${context.label}: ${formatBRL(val)}`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }
}

// Desenha ou atualiza o gráfico de linha de evolução diária de gastos
function renderDailyChart(expensesValues, labels) {
  const ctx = document.getElementById('daily-chart');
  const noDataEl = document.getElementById('daily-chart-no-data');
  const chartContainer = ctx.parentElement;

  const totalExpenses = expensesValues.reduce((sum, val) => sum + val, 0);

  if (totalExpenses === 0) {
    chartContainer.classList.add('hidden');
    noDataEl.classList.remove('hidden');
    if (dailyChart) {
      dailyChart.destroy();
      dailyChart = null;
    }
    return;
  }

  chartContainer.classList.remove('hidden');
  noDataEl.classList.add('hidden');

  const isLightTheme = document.body.classList.contains('light-theme');
  const lineColor = isLightTheme ? '#4f46e5' : '#818cf8'; // Indigo no light, light indigo no dark
  const fillColor = isLightTheme ? 'rgba(79, 70, 229, 0.05)' : 'rgba(129, 140, 248, 0.05)';
  const gridColor = isLightTheme ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
  const textColor = isLightTheme ? '#475569' : '#94a3b8';

  if (dailyChart) {
    dailyChart.data.labels = labels;
    dailyChart.data.datasets[0].data = expensesValues;
    dailyChart.data.datasets[0].borderColor = lineColor;
    dailyChart.data.datasets[0].backgroundColor = fillColor;
    dailyChart.data.datasets[0].pointBackgroundColor = lineColor;
    dailyChart.options.scales.x.grid.color = gridColor;
    dailyChart.options.scales.x.ticks.color = textColor;
    dailyChart.options.scales.y.grid.color = gridColor;
    dailyChart.options.scales.y.ticks.color = textColor;
    dailyChart.update();
  } else {
    dailyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Gasto',
          data: expensesValues,
          borderColor: lineColor,
          backgroundColor: fillColor,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 1,
          pointHoverRadius: 4,
          pointBackgroundColor: lineColor
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ' Gasto: ' + formatBRL(context.parsed.y);
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: gridColor
            },
            ticks: {
              color: textColor,
              font: {
                family: 'Inter',
                size: 10
              }
            }
          },
          y: {
            grid: {
              color: gridColor
            },
            ticks: {
              color: textColor,
              font: {
                family: 'Inter',
                size: 10
              },
              callback: function(value) {
                return 'R$ ' + value;
              }
            }
          }
        }
      }
    });
  }
}

// Popula a tabela de Transações com filtros aplicados
export function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactions-table-body');
  tbody.innerHTML = '';

  // 1. Obter valores dos filtros
  const searchVal = document.getElementById('filter-search').value.toLowerCase();

  // 1b. Obter filtro de período do histórico pelos seletores nativos
  const activeHistBtn = document.querySelector('#hist-period-buttons .btn-period.active');
  const histPeriod = activeHistBtn ? activeHistBtn.getAttribute('data-period') : 'all';

  const histYear       = document.getElementById('hist-year-sel')?.value;      // "YYYY"
  const histMonthVal   = document.getElementById('hist-month-input')?.value;   // "YYYY-MM"
  const histWeekDate   = document.getElementById('hist-week-input')?.value;    // "YYYY-MM-DD" (qualquer dia da semana)
  const histDay        = document.getElementById('hist-day-input')?.value;     // "YYYY-MM-DD"

  const now = new Date();

  // 2. Filtrar
  const filtered = transactions.filter(tx => {
    // Busca por descrição ou categoria
    const matchSearch = tx.description.toLowerCase().includes(searchVal) || 
                        tx.category.toLowerCase().includes(searchVal);
    
    // Filtro de período do histórico
    let matchPeriod = true;
    if (histPeriod !== 'all') {
      const txDate = new Date(tx.date + 'T12:00:00');
      if (histPeriod === 'anual') {
        const selectedYear = histYear ? Number(histYear) : now.getFullYear();
        matchPeriod = txDate.getFullYear() === selectedYear;
      } else if (histPeriod === 'mensal') {
        // histMonthVal formato "YYYY-MM"
        if (histMonthVal) {
          const [y, m] = histMonthVal.split('-').map(Number);
          matchPeriod = txDate.getFullYear() === y && txDate.getMonth() === (m - 1);
        } else {
          matchPeriod = txDate.getFullYear() === now.getFullYear() && txDate.getMonth() === now.getMonth();
        }
      } else if (histPeriod === 'semanal') {
        // O usuário seleciona qualquer dia da semana → calculamos Seg a Dom
        const refDate = histWeekDate ? new Date(histWeekDate + 'T12:00:00') : now;
        const distToMon = refDate.getDay() === 0 ? 6 : refDate.getDay() - 1;
        const monday = new Date(refDate); monday.setDate(refDate.getDate() - distToMon); monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
        matchPeriod = txDate >= monday && txDate <= sunday;
      } else if (histPeriod === 'diario') {
        const selectedDayStr = histDay || (now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'));
        matchPeriod = tx.date === selectedDayStr;
      }
    }

    return matchSearch && matchPeriod;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum lançamento corresponde aos filtros.</td></tr>`;
    return;
  }

  // Ordenar transações por data decrescente (mais recente primeiro)
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 3. Renderizar linhas
  filtered.forEach(tx => {
    const tr = document.createElement('tr');
    
    // Icone de acordo com o tipo
    let iconHTML = '';
    let badgeClass = '';
    if (tx.type === 'Receita') {
      iconHTML = '<i data-lucide="chevron-up" class="color-success" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></i>';
      badgeClass = 'badge-success';
    } else if (tx.type === 'Despesa') {
      iconHTML = '<i data-lucide="chevron-down" class="color-danger" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></i>';
      badgeClass = 'badge-danger';
    } else {
      iconHTML = '<i data-lucide="piggy-bank" class="color-info" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></i>';
      badgeClass = 'badge-info';
    }

    // Formatar data humana DD/MM/AAAA
    const parts = tx.date.split('-');
    const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : tx.date;

    tr.innerHTML = `
      <td>${dateFormatted}</td>
      <td><span class="badge ${badgeClass}">${tx.type}</span></td>
      <td>${tx.category}</td>
      <td>${iconHTML} ${tx.account}</td>
      <td><strong>${tx.description}</strong></td>
      <td class="text-right ${tx.type === 'Receita' ? 'color-success' : tx.type === 'Despesa' ? 'color-danger' : 'color-info'}">
        <strong>${tx.type === 'Receita' ? '+' : '-'}&nbsp;${formatBRL(tx.value)}</strong>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Ativar ícones gerados
  lucide.createIcons();
}

export function renderSettingsForm(configs) {
  const container = document.getElementById('settings-cards-container');
  if (!container) return;

  container.innerHTML = '';
  const cardIdsStr = configs['cartoes_lista'];
  const cardIds = cardIdsStr ? cardIdsStr.split(',').filter(id => id.trim() !== '') : [];

  if (cardIds.length === 0) {
    container.innerHTML = `<p class="text-muted text-center" style="padding: 20px;">Nenhum cartão cadastrado. Use o botão "+ Novo Cartão" para adicionar.</p>`;
    return;
  }

  cardIds.forEach(id => {
    const cardName = configs[`${id}_nome`] || id;
    const limit = configs[`${id}_limite`] || '1000.00';
    const closing = configs[`${id}_fechamento`] || '5';
    const due = configs[`${id}_vencimento`] || '15';

    const itemDiv = document.createElement('div');
    itemDiv.className = 'form-card-settings-item';
    itemDiv.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
    itemDiv.style.paddingBottom = '15px';
    itemDiv.style.marginBottom = '15px';
    
    itemDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div class="form-section-title" style="margin-top: 10px; margin-bottom: 0; border-left: 3px solid var(--primary-color); padding-left: 10px;">${cardName}</div>
        <button type="button" class="btn btn-secondary btn-delete-card" data-id="${id}" data-name="${cardName}" style="padding: 4px 8px; font-size: 0.75rem; color: var(--danger-color); border-color: rgba(244, 63, 94, 0.2); background: rgba(244, 63, 94, 0.05);">
          <i data-lucide="trash-2" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"></i> Excluir
        </button>
      </div>
      <div class="form-row-three">
        <div class="input-control">
          <label>Limite (R$)</label>
          <input type="number" step="0.01" id="config-${id}-limit" value="${limit}" required />
        </div>
        <div class="input-control">
          <label>Dia Fechamento</label>
          <input type="number" min="1" max="31" id="config-${id}-closing" value="${closing}" required />
        </div>
        <div class="input-control">
          <label>Dia Vencimento</label>
          <input type="number" min="1" max="31" id="config-${id}-due" value="${due}" required />
        </div>
      </div>
    `;
    container.appendChild(itemDiv);
  });

  // Re-renderizar ícones
  lucide.createIcons();
}

// Alimenta dinamicamente os selects da aplicação com base nos cartões cadastrados e contas customizadas
export function populateAccountSelectors(configs) {
  const txAccountSelect = document.getElementById('tx-account');
  const filterAccountSelect = document.getElementById('filter-account');
  const salAccountSelect = document.getElementById('sal-account');

  if (!txAccountSelect) return;

  const cardIdsStr = configs['cartoes_lista'];
  const cardIds = cardIdsStr ? cardIdsStr.split(',').filter(id => id.trim() !== '') : [];

  const payIdsStr = configs['formas_pagamento_lista'];
  const payIds = payIdsStr ? payIdsStr.split(',').filter(id => id.trim() !== '') : [];

  // Atualizar contador de cartões nas formas de pagamento se existir
  const cardsCountEl = document.getElementById('payment-methods-cards-count');
  if (cardsCountEl) {
    cardsCountEl.innerText = `${cardIds.length} Ativo(s)`;
  }

  // 1. Alimentar select do Modal de Transações
  let optionsHTML = '';

  // Adicionar formas de pagamento customizadas
  payIds.forEach(id => {
    const payName = configs[`${id}_nome`] || id;
    optionsHTML += `<option value="${payName}">${payName}</option>`;
  });

  // Adicionar cartões de crédito
  cardIds.forEach(id => {
    const cardName = configs[`${id}_nome`] || id;
    optionsHTML += `<option value="Cartão ${cardName}">Cartão ${cardName}</option>`;
  });

  txAccountSelect.innerHTML = optionsHTML;

  // Sincronizar select de Salários se existir
  if (salAccountSelect) {
    salAccountSelect.innerHTML = optionsHTML;
  }

  // Sincronizar select de Destino de Importação se existir
  const importAccountSelect = document.getElementById('import-account-target');
  if (importAccountSelect) {
    importAccountSelect.innerHTML = optionsHTML;
  }

  // 2. Alimentar select de Filtros se existir (preservando o valor previamente selecionado)
  if (filterAccountSelect) {
    const previousFilterVal = filterAccountSelect.value;
    
    filterAccountSelect.innerHTML = `<option value="all">Todos</option>`;
    payIds.forEach(id => {
      const payName = configs[`${id}_nome`] || id;
      filterAccountSelect.innerHTML += `<option value="${payName}">${payName}</option>`;
    });
    cardIds.forEach(id => {
      const cardName = configs[`${id}_nome`] || id;
      filterAccountSelect.innerHTML += `<option value="Cartão ${cardName}">${cardName}</option>`;
    });

    // Tentar re-selecionar o valor anterior
    if (Array.from(filterAccountSelect.options).some(opt => opt.value === previousFilterVal)) {
      filterAccountSelect.value = previousFilterVal;
    } else {
      filterAccountSelect.value = 'all';
    }
  }
}

/**
 * Renderiza a lista de transações extraídas pelo Gemini na tabela de revisão no modal
 * @param {Array} transacoes - Lista de objetos de transação
 */
export function renderImportedTransactions(transacoes) {
  const tbody = document.getElementById('imported-transactions-body');
  const countTotalEl = document.getElementById('imported-count-total');
  const countSelectedEl = document.getElementById('imported-count-selected');
  const valueTotalEl = document.getElementById('imported-value-total');
  const btnCountEl = document.getElementById('btn-import-count');
  const checkAll = document.getElementById('check-all-imported');

  if (!tbody) return;

  tbody.innerHTML = '';
  
  if (!transacoes || transacoes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhuma transação válida extraída do PDF.</td></tr>`;
    if (countTotalEl) countTotalEl.innerText = '0';
    if (countSelectedEl) countSelectedEl.innerText = '0';
    if (valueTotalEl) valueTotalEl.innerText = 'R$ 0,00';
    if (btnCountEl) btnCountEl.innerText = '0';
    return;
  }

  const catIdsStr = currentConfigs['categorias_lista'];
  const catIds = catIdsStr ? catIdsStr.split(',').filter(id => id.trim() !== '') : [];
  let categoriasValidas = catIds.map(id => currentConfigs[`${id}_nome`] || id);
  if (categoriasValidas.length === 0) {
    categoriasValidas = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Salário', 'Rendimentos', 'Investimento', 'Outros'];
  }

  // Renderizar cada linha
  transacoes.forEach((tx, idx) => {
    const tr = document.createElement('tr');
    tr.id = `imported-row-${idx}`;

    // Opções de categorias
    let selectOptions = '';
    categoriasValidas.forEach(cat => {
      selectOptions += `<option value="${cat}" ${tx.category === cat ? 'selected' : ''}>${cat}</option>`;
    });

    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="tx-import-check" data-idx="${idx}" checked style="width:16px;height:16px;" />
        <input type="hidden" class="tx-import-type" value="${tx.type}" />
      </td>
      <td>
        <input type="date" class="tx-import-date" value="${tx.date}" style="font-size:0.85rem;" />
      </td>
      <td>
        <input type="text" class="tx-import-desc" value="${tx.description}" style="font-size:0.85rem;" />
      </td>
      <td>
        <select class="tx-import-cat" style="font-size:0.85rem;">
          ${selectOptions}
        </select>
      </td>
      <td>
        <input type="number" step="0.01" class="tx-import-val" value="${tx.value.toFixed(2)}" style="text-align: right; font-weight:600;" />
      </td>
      <td style="text-align: center;">
        <button type="button" class="btn-delete-imported" data-idx="${idx}" style="background:none;border:none;color:var(--danger-color);cursor:pointer;" title="Remover linha">
          <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Função para recalcular os resumos/totais
  const atualizarResumo = () => {
    let totalSelecionados = 0;
    let valorTotal = 0;
    
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      const checkbox = row.querySelector('.tx-import-check');
      if (checkbox && checkbox.checked) {
        totalSelecionados++;
        const valInput = row.querySelector('.tx-import-val');
        if (valInput) {
          valorTotal += Math.abs(parseFloat(valInput.value) || 0);
        }
      }
    });

    if (countTotalEl) countTotalEl.innerText = transacoes.length;
    if (countSelectedEl) countSelectedEl.innerText = totalSelecionados;
    if (btnCountEl) btnCountEl.innerText = totalSelecionados;
    if (valueTotalEl) valueTotalEl.innerText = formatBRL(valorTotal);
  };

  // Listeners para atualizar totais ao interagir
  tbody.addEventListener('change', (e) => {
    if (e.target.classList.contains('tx-import-check') || e.target.classList.contains('tx-import-val')) {
      atualizarResumo();
    }
  });

  // Ouvinte para excluir uma linha da tabela de importação
  tbody.addEventListener('click', (e) => {
    const btnDelete = e.target.closest('.btn-delete-imported');
    if (btnDelete) {
      const idx = btnDelete.getAttribute('data-idx');
      const row = document.getElementById(`imported-row-${idx}`);
      if (row) {
        row.remove();
        atualizarResumo();
      }
    }
  });

  // Ouvinte para marcar/desmarcar todos
  if (checkAll) {
    checkAll.checked = true;
    checkAll.addEventListener('change', () => {
      const checkboxes = tbody.querySelectorAll('.tx-import-check');
      checkboxes.forEach(cb => cb.checked = checkAll.checked);
      atualizarResumo();
    });
  }

  // Inicializar o resumo
  atualizarResumo();

  // Exibir a etapa de revisão
  document.querySelectorAll('.import-step').forEach(step => step.classList.add('hidden'));
  const stepReviewEl = document.getElementById('import-step-review');
  if (stepReviewEl) stepReviewEl.classList.remove('hidden');

  // Inicializar ícones Lucide da tabela
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Redimensiona a imagem selecionada usando Canvas para 128x128 pixels.
 * Exporta em formato JPEG com compactação para caber de forma eficiente na planilha.
 * @param {File} file - Arquivo de imagem selecionado pelo usuário
 * @returns {Promise<string>} String Base64 contendo a imagem JPEG
 */
function redimensionarImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const size = 128; // Tamanho ideal para o avatar
        canvas.width = size;
        canvas.height = size;
        
        // Calcular enquadramento proporcional (crop central)
        const scale = Math.max(size / img.width, size / img.height);
        const x = (size - img.width * scale) / 2;
        const y = (size - img.height * scale) / 2;
        
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        
        // Exportar como jpeg compactado (qualidade 0.8)
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Falha ao carregar a imagem no Canvas.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Exibe uma notificação toast minimalista e clean na tela
 * @param {string} message - A mensagem a ser exibida
 * @param {'success'|'error'|'warning'|'info'} type - O tipo de notificação
 */
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Selecionar ícone correspondente do Lucide
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  if (type === 'warning') iconName = 'alert-circle';

  toast.innerHTML = `
    <div class="toast-icon"><i data-lucide="${iconName}"></i></div>
    <div class="toast-content">${message}</div>
    <button class="toast-close" type="button" title="Fechar">
      <i data-lucide="x"></i>
    </button>
  `;

  container.appendChild(toast);

  // Inicializar ícones do Lucide no toast recém-criado
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  // Animar entrada
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Configurar auto-fechamento após 4 segundos
  const autoCloseTimeout = setTimeout(() => {
    closeToast(toast);
  }, 4000);

  // Configurar evento de clique no botão fechar
  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearTimeout(autoCloseTimeout);
      closeToast(toast);
    });
  }
}

function closeToast(toast) {
  toast.classList.add('hide');
  toast.classList.remove('show');
  // Remover do DOM após a conclusão da transição CSS (350ms)
  setTimeout(() => {
    toast.remove();
    // Limpar container se estiver vazio
    const container = document.getElementById('toast-container');
    if (container && container.childElementCount === 0) {
      container.remove();
    }
  }, 350);
}

// Helpers para gerar selects inline em modo de edição
function getIconOptions(selectedIcon) {
  const icons = [
    { value: 'tag', label: 'Etiqueta' },
    { value: 'utensils', label: 'Alimentação' },
    { value: 'car', label: 'Transporte' },
    { value: 'home', label: 'Moradia' },
    { value: 'gamepad-2', label: 'Lazer' },
    { value: 'heart', label: 'Saúde' },
    { value: 'briefcase', label: 'Salário' },
    { value: 'trending-up', label: 'Rendimentos' },
    { value: 'piggy-bank', label: 'Poupança' },
    { value: 'layers', label: 'Outros' },
    { value: 'shopping-bag', label: 'Compras' },
    { value: 'book', label: 'Estudos' },
    { value: 'shield', label: 'Seguros' },
    { value: 'tv', label: 'Streaming' },
    { value: 'coffee', label: 'Café' },
    { value: 'plane', label: 'Viagens' }
  ];
  return icons.map(i => `<option value="${i.value}" ${i.value === selectedIcon ? 'selected' : ''}>${i.label}</option>`).join('');
}

function getColorOptions(selectedColor) {
  const colors = [
    { value: 'primary', label: 'Primary (Azul/Roxo)' },
    { value: 'info', label: 'Info (Ciano)' },
    { value: 'success', label: 'Success (Verde)' },
    { value: 'warning', label: 'Warning (Amarelo)' },
    { value: 'danger', label: 'Danger (Vermelho)' },
    { value: 'secondary', label: 'Secondary (Cinza)' }
  ];
  return colors.map(c => `<option value="${c.value}" ${c.value === selectedColor ? 'selected' : ''}>${c.label}</option>`).join('');
}

function getPaymentIconOptions(selectedIcon) {
  const icons = [
    { value: 'wallet', label: 'Carteira' },
    { value: 'banknote', label: 'Cédula' },
    { value: 'landmark', label: 'Banco' },
    { value: 'credit-card', label: 'Cartão' },
    { value: 'building', label: 'Edifício' }
  ];
  return icons.map(i => `<option value="${i.value}" ${i.value === selectedIcon ? 'selected' : ''}>${i.label}</option>`).join('');
}

function getInlineCategoryIconOptionsHTML(selectedIcon) {
  const icons = [
    { value: 'tag', title: 'Etiqueta' },
    { value: 'utensils', title: 'Alimentação' },
    { value: 'car', title: 'Transporte' },
    { value: 'home', title: 'Moradia' },
    { value: 'gamepad-2', title: 'Lazer' },
    { value: 'heart', title: 'Saúde' },
    { value: 'briefcase', title: 'Salário' },
    { value: 'trending-up', title: 'Rendimentos' },
    { value: 'piggy-bank', title: 'Poupança' },
    { value: 'layers', title: 'Outros' },
    { value: 'shopping-bag', title: 'Compras' },
    { value: 'book', title: 'Estudos' },
    { value: 'shield', title: 'Seguros' },
    { value: 'tv', title: 'Streaming' },
    { value: 'coffee', title: 'Café' },
    { value: 'plane', title: 'Viagens' }
  ];
  return icons.map(i => `
    <button type="button" class="btn-picker-option ${i.value === selectedIcon ? 'active' : ''}" data-value="${i.value}" title="${i.title}">
      <i data-lucide="${i.value}"></i>
    </button>
  `).join('');
}

function getInlinePaymentIconOptionsHTML(selectedIcon) {
  const icons = [
    { value: 'wallet', title: 'Carteira' },
    { value: 'banknote', title: 'Cédula' },
    { value: 'landmark', title: 'Banco' },
    { value: 'credit-card', title: 'Cartão' },
    { value: 'building', title: 'Edifício' }
  ];
  return icons.map(i => `
    <button type="button" class="btn-picker-option ${i.value === selectedIcon ? 'active' : ''}" data-value="${i.value}" title="${i.title}">
      <i data-lucide="${i.value}"></i>
    </button>
  `).join('');
}

// Alimenta o select de categorias no modal de transações
export function populateCategorySelectors(configs) {
  const txCategorySelect = document.getElementById('tx-category');
  if (!txCategorySelect) return;

  const catIdsStr = configs['categorias_lista'];
  const catIds = catIdsStr ? catIdsStr.split(',').filter(id => id.trim() !== '') : [];

  let optionsHTML = '';
  catIds.forEach(id => {
    const name = configs[`${id}_nome`] || id;
    optionsHTML += `<option value="${name}">${name}</option>`;
  });

  if (optionsHTML === '') {
    optionsHTML = `
      <option value="Alimentação">Alimentação</option>
      <option value="Transporte">Transporte</option>
      <option value="Moradia">Moradia</option>
      <option value="Lazer">Lazer</option>
      <option value="Saúde">Saúde</option>
      <option value="Salário">Salário</option>
      <option value="Rendimentos">Rendimentos</option>
      <option value="Investimento">Investimento</option>
      <option value="Outros">Outros</option>
    `;
  }

  txCategorySelect.innerHTML = optionsHTML;
}

// Renderiza a visualização estática das categorias
export function renderCategoriesList(configs) {
  currentConfigs = configs;
  const container = document.getElementById('categories-list-container');
  if (!container) return;

  const catIdsStr = configs['categorias_lista'];
  const catIds = catIdsStr ? catIdsStr.split(',').filter(id => id.trim() !== '') : [];

  container.innerHTML = '';

  if (catIds.length === 0) {
    container.innerHTML = '<p class="text-muted text-center text-xs" style="padding:15px 0;">Nenhuma categoria cadastrada.</p>';
    return;
  }

  catIds.forEach((id, index) => {
    const nome = configs[`${id}_nome`] || id;
    const tipo = configs[`${id}_tipo`] || 'Despesa';
    const icon = configs[`${id}_icon`] || 'tag';
    const color = configs[`${id}_color`] || 'secondary';
    const isLast = index === catIds.length - 1;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'info-item';
    if (isLast) {
      itemDiv.style.border = 'none';
    }
    itemDiv.style.padding = '4px 0';
    itemDiv.innerHTML = `
      <span class="info-label" style="display: flex; align-items: center; gap: 8px;">
        <i data-lucide="${icon}" class="color-${color}" style="width: 14px; height: 14px;"></i> ${nome}
      </span>
      <span class="info-value text-xs text-muted">${tipo}</span>
    `;
    container.appendChild(itemDiv);
  });

  // Também atualizar os selects do modal de transações
  populateCategorySelectors(configs);

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Renderiza o formulário de edição das categorias
export function renderCategoriesSettingsForm(configs) {
  const container = document.getElementById('settings-categories-container');
  if (!container) return;

  const catIdsStr = configs['categorias_lista'];
  const catIds = catIdsStr ? catIdsStr.split(',').filter(id => id.trim() !== '') : [];

  container.innerHTML = '';

  catIds.forEach(id => {
    const nome = configs[`${id}_nome`] || id;
    const tipo = configs[`${id}_tipo`] || 'Despesa';
    const icon = configs[`${id}_icon`] || 'tag';
    const color = configs[`${id}_color`] || 'secondary';

    const rowDiv = document.createElement('div');
    rowDiv.className = 'settings-edit-row';
    rowDiv.setAttribute('data-id', id);
    rowDiv.innerHTML = `
      <div class="edit-row-inputs">
        <div class="edit-row-inputs-top">
          <input type="text" id="cat-edit-${id}-name" value="${nome}" placeholder="Nome da categoria" required />
        </div>
        <div class="edit-row-inputs-bottom">
          <select id="cat-edit-${id}-type">
            <option value="Despesa" ${tipo === 'Despesa' ? 'selected' : ''}>Despesa</option>
            <option value="Receita" ${tipo === 'Receita' ? 'selected' : ''}>Receita</option>
            <option value="Poupança" ${tipo === 'Poupança' ? 'selected' : ''}>Poupança</option>
            <option value="Outros" ${tipo === 'Outros' ? 'selected' : ''}>Outros</option>
          </select>
          <div class="custom-icon-picker inline-picker" data-id="${id}" data-type="category" style="position: relative;">
            <input type="hidden" id="cat-edit-${id}-icon" value="${icon}" />
            <button type="button" class="btn-picker-trigger" id="cat-edit-${id}-trigger" title="Alterar Ícone">
              <i data-lucide="${icon}"></i>
            </button>
            <div class="picker-popover hidden" id="cat-edit-${id}-popover">
              <div class="picker-popover-grid" style="grid-template-columns: repeat(4, 1fr); padding: 4px; gap: 4px;">
                ${getInlineCategoryIconOptionsHTML(icon)}
              </div>
            </div>
          </div>
          <select id="cat-edit-${id}-color">
            ${getColorOptions(color)}
          </select>
        </div>
      </div>
      <button type="button" class="btn-delete-item btn-delete-category" data-id="${id}" title="Excluir Categoria">
        <i data-lucide="trash-2"></i>
      </button>
    `;
    container.appendChild(rowDiv);
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Renderiza a visualização estática das formas de pagamento
export function renderPaymentsList(configs) {
  currentConfigs = configs;
  const container = document.getElementById('payments-list-container');
  if (!container) return;

  const payIdsStr = configs['formas_pagamento_lista'];
  const payIds = payIdsStr ? payIdsStr.split(',').filter(id => id.trim() !== '') : [];

  const cardIdsStr = configs['cartoes_lista'];
  const cardIds = cardIdsStr ? cardIdsStr.split(',').filter(id => id.trim() !== '') : [];

  container.innerHTML = '';

  if (payIds.length === 0 && cardIds.length === 0) {
    container.innerHTML = '<p class="text-muted text-center text-xs" style="padding:15px 0;">Nenhuma forma de pagamento.</p>';
    return;
  }

  // 1. Mostrar formas de pagamento dinâmicas customizadas
  payIds.forEach((id) => {
    const nome = configs[`${id}_nome`] || id;
    const icon = configs[`${id}_icon`] || 'wallet';
    const color = configs[`${id}_color`] || 'success';

    const itemDiv = document.createElement('div');
    itemDiv.className = 'info-item';
    itemDiv.style.padding = '4px 0';
    itemDiv.innerHTML = `
      <span class="info-label" style="display: flex; align-items: center; gap: 8px;">
        <i data-lucide="${icon}" class="color-${color}" style="width: 14px; height: 14px;"></i> ${nome}
      </span>
      <span class="badge badge-success" style="font-size: 0.7rem; padding: 2px 6px;">Ativo</span>
    `;
    container.appendChild(itemDiv);
  });

  // 2. Mostrar a linha agrupada de Cartões de Crédito (como no design estático original)
  const cardItemDiv = document.createElement('div');
  cardItemDiv.className = 'info-item';
  cardItemDiv.style.padding = '4px 0';
  cardItemDiv.style.border = 'none'; // Ultimo item do container
  cardItemDiv.innerHTML = `
    <span class="info-label" style="display: flex; align-items: center; gap: 8px;">
      <i data-lucide="credit-card" class="color-primary" style="width: 14px; height: 14px;"></i> Cartões de Crédito
    </span>
    <span id="payment-methods-cards-count" class="info-value text-xs text-muted">${cardIds.length} Ativo(s)</span>
  `;
  container.appendChild(cardItemDiv);

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Renderiza o formulário de edição das formas de pagamento
export function renderPaymentsSettingsForm(configs) {
  const container = document.getElementById('settings-payments-container');
  if (!container) return;

  const payIdsStr = configs['formas_pagamento_lista'];
  const payIds = payIdsStr ? payIdsStr.split(',').filter(id => id.trim() !== '') : [];

  container.innerHTML = '';

  payIds.forEach(id => {
    const nome = configs[`${id}_nome`] || id;
    const icon = configs[`${id}_icon`] || 'wallet';
    const color = configs[`${id}_color`] || 'success';

    const rowDiv = document.createElement('div');
    rowDiv.className = 'settings-edit-row';
    rowDiv.setAttribute('data-id', id);
    rowDiv.innerHTML = `
      <div class="edit-row-inputs">
        <div class="edit-row-inputs-top">
          <input type="text" id="pay-edit-${id}-name" value="${nome}" placeholder="Nome da Conta" required />
        </div>
        <div class="edit-row-inputs-bottom">
          <div class="custom-icon-picker inline-picker" data-id="${id}" data-type="payment" style="position: relative;">
            <input type="hidden" id="pay-edit-${id}-icon" value="${icon}" />
            <button type="button" class="btn-picker-trigger" id="pay-edit-${id}-trigger" title="Alterar Ícone">
              <i data-lucide="${icon}"></i>
            </button>
            <div class="picker-popover hidden" id="pay-edit-${id}-popover">
              <div class="picker-popover-grid" style="grid-template-columns: repeat(5, 1fr); padding: 4px; gap: 4px;">
                ${getInlinePaymentIconOptionsHTML(icon)}
              </div>
            </div>
          </div>
          <select id="pay-edit-${id}-color">
            ${getColorOptions(color)}
          </select>
        </div>
      </div>
      <button type="button" class="btn-delete-item btn-delete-payment" data-id="${id}" title="Excluir Conta">
        <i data-lucide="trash-2"></i>
      </button>
    `;
    container.appendChild(rowDiv);
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

