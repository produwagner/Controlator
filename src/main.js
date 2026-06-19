/* PONTO DE ENTRADA PRINCIPAL DA APLICAÇÃO (MAIN) */

import { initAuth, login, logout, getSavedClientId, saveClientId, isAuthenticated, DEFAULT_CLIENT_ID } from './auth.js';
import { 
  buscarOuCriarPlanilha, 
  carregarTransacoes, 
  carregarConfiguracoes, 
  adicionarTransacao, 
  adicionarTransacoesEmLote,
  salvarConfiguracoes,
  carregarPerfil,
  salvarPerfil,
  excluirTransacao,
  atualizarTransacao
} from './sheets.js';
import { 
  initUI, 
  showLoading, 
  hideLoading, 
  updateUserInfo, 
  updateDashboard, 
  renderTransactionsTable, 
  renderSettingsForm,
  populateAccountSelectors,
  renderImportedTransactions,
  renderCategoriesList,
  renderCategoriesSettingsForm,
  renderPaymentsList,
  renderPaymentsSettingsForm,
  showToast
} from './ui.js';
import {
  saveGeminiKey,
  extrairTextoDoPDF,
  processarFaturaComGemini
} from './ai.js';

// Estado global em memória do aplicativo
let APP_STATE = {
  transactions: [],
  configs: {}
};

// Converte uma URL de imagem externa para Base64 (JPEG compactado) usando Canvas
function converterUrlImagemParaBase64(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Evita erro de segurança (CORS) no canvas.toDataURL()
    img.onload = function() {
      try {
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
      } catch (err) {
        reject(new Error('Erro ao processar imagem no Canvas: ' + err.message));
      }
    };
    img.onerror = () => reject(new Error('Falha ao carregar a imagem a partir da URL.'));
    img.src = url;
  });
}

// Callback disparada quando o login/logout do Google muda de estado
async function handleAuthChange(loggedIn, userInfo) {
  const loginScreen = document.getElementById('login-screen');
  const appWorkspace = document.getElementById('app-workspace');

  if (loggedIn) {
    // 1. Mostrar layout do app e esconder tela de login
    loginScreen.classList.add('hidden');
    appWorkspace.classList.remove('hidden');
    updateUserInfo(userInfo);

    // 2. Sincronizar dados do Google Drive
    await sincronizarDados();
  } else {
    // Exibir tela de login e esconder app
    loginScreen.classList.remove('hidden');
    appWorkspace.classList.add('hidden');
    updateUserInfo(null);
    
    // Limpar estado
    APP_STATE.transactions = [];
    APP_STATE.configs = {};
  }
}

// Carrega tudo do Google Sheets e atualiza a interface
async function sincronizarDados() {
  showLoading('Sincronizando dados com o Google Drive...');
  try {
    // 1. Inicializar planilha (buscar no Drive ou criar)
    const sheetId = await buscarOuCriarPlanilha();
    
    // Atualizar UI com o link e ID da planilha
    const openSheetBtn = document.getElementById('btn-open-spreadsheet');
    if (openSheetBtn) {
      openSheetBtn.href = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
      openSheetBtn.classList.remove('hidden');
    }
    
    const settingsSheetId = document.getElementById('settings-sheet-id');
    if (settingsSheetId) {
      settingsSheetId.innerText = sheetId;
    }
    
    const statusBadge = document.getElementById('settings-connection-status');
    if (statusBadge) {
      statusBadge.innerText = 'Conectado';
      statusBadge.className = 'badge badge-success';
    }

    // 2. Carregar configurações, transações e perfil em paralelo
    const [configs, transactions, perfil] = await Promise.all([
      carregarConfiguracoes(),
      carregarTransacoes(),
      carregarPerfil()
    ]);

    APP_STATE.configs = configs;
    APP_STATE.transactions = transactions;

    // Sincronizar dados do perfil para o localStorage do navegador
    if (perfil && perfil.nome_usuario) {
      const customInfo = {
        name: perfil.nome_usuario,
        avatar: perfil.avatar_usuario || ''
      };
      localStorage.setItem('controlator_custom_user_info', JSON.stringify(customInfo));
      
      // Pegar as informações atuais do login para mesclar e atualizar a UI
      const savedUserStr = localStorage.getItem('controlator_user_info');
      const authUser = savedUserStr ? JSON.parse(savedUserStr) : { name: 'Usuário', avatar: '' };
      updateUserInfo(authUser);
    } else {
      // Se não existe perfil na planilha mas o usuário já tem perfil personalizado ou conta Google,
      // inicializar o perfil na planilha
      const savedUserStr = localStorage.getItem('controlator_user_info');
      if (savedUserStr) {
        try {
          const authUser = JSON.parse(savedUserStr);
          const customUserStr = localStorage.getItem('controlator_custom_user_info');
          let nameToSave = authUser.name || 'Usuário';
          let avatarToSave = authUser.avatar || '';
          
          if (customUserStr) {
            const customInfo = JSON.parse(customUserStr);
            nameToSave = customInfo.name || nameToSave;
            if (customInfo.avatar) {
              avatarToSave = customInfo.avatar;
            }
          } else {
            // Inicializar customização local com a foto do Google para novos registros
            // Se o avatar original do Google for uma URL, tentar converter para Base64
            if (avatarToSave && avatarToSave.startsWith('http')) {
              try {
                avatarToSave = await converterUrlImagemParaBase64(avatarToSave);
              } catch (err) {
                console.warn('Erro ao converter avatar inicial do Google para base64:', err);
              }
            }
            localStorage.setItem('controlator_custom_user_info', JSON.stringify({
              name: nameToSave,
              avatar: avatarToSave
            }));
          }
          
          await salvarPerfil({
            nome_usuario: nameToSave,
            avatar_usuario: avatarToSave
          });
        } catch (e) {
          console.error('Erro ao inicializar perfil na planilha:', e);
        }
      }
    }

    let configsChanged = false;

    // Inicializar lista padrão de cartões caso seja a primeira vez
    if (APP_STATE.configs['cartoes_lista'] === undefined) {
      APP_STATE.configs['cartoes_lista'] = 'nubank,bb,mp';
      APP_STATE.configs['nubank_nome'] = 'Nubank';
      APP_STATE.configs['nubank_limite'] = '5950.00';
      APP_STATE.configs['nubank_fechamento'] = '6';
      APP_STATE.configs['nubank_vencimento'] = '15';
      
      APP_STATE.configs['bb_nome'] = 'Banco do Brasil';
      APP_STATE.configs['bb_limite'] = '1743.00';
      APP_STATE.configs['bb_fechamento'] = '3';
      APP_STATE.configs['bb_vencimento'] = '13';
      
      APP_STATE.configs['mp_nome'] = 'Mercado Pago';
      APP_STATE.configs['mp_limite'] = '4000.00';
      APP_STATE.configs['mp_fechamento'] = '9';
      APP_STATE.configs['mp_vencimento'] = '15';
      configsChanged = true;
    }

    // Inicializar lista padrão de categorias caso seja a primeira vez
    if (APP_STATE.configs['categorias_lista'] === undefined) {
      APP_STATE.configs['categorias_lista'] = 'alimentacao,transporte,moradia,lazer,saude,salario,rendimentos,poupanca,outros';
      APP_STATE.configs['alimentacao_nome'] = 'Alimentação';
      APP_STATE.configs['alimentacao_tipo'] = 'Despesa';
      APP_STATE.configs['alimentacao_icon'] = 'utensils';
      APP_STATE.configs['alimentacao_color'] = 'info';

      APP_STATE.configs['transporte_nome'] = 'Transporte';
      APP_STATE.configs['transporte_tipo'] = 'Despesa';
      APP_STATE.configs['transporte_icon'] = 'car';
      APP_STATE.configs['transporte_color'] = 'danger';

      APP_STATE.configs['moradia_nome'] = 'Moradia';
      APP_STATE.configs['moradia_tipo'] = 'Despesa';
      APP_STATE.configs['moradia_icon'] = 'home';
      APP_STATE.configs['moradia_color'] = 'primary';

      APP_STATE.configs['lazer_nome'] = 'Lazer';
      APP_STATE.configs['lazer_tipo'] = 'Despesa';
      APP_STATE.configs['lazer_icon'] = 'gamepad-2';
      APP_STATE.configs['lazer_color'] = 'warning';

      APP_STATE.configs['saude_nome'] = 'Saúde';
      APP_STATE.configs['saude_tipo'] = 'Despesa';
      APP_STATE.configs['saude_icon'] = 'heart';
      APP_STATE.configs['saude_color'] = 'success';

      APP_STATE.configs['salario_nome'] = 'Salário';
      APP_STATE.configs['salario_tipo'] = 'Receita';
      APP_STATE.configs['salario_icon'] = 'briefcase';
      APP_STATE.configs['salario_color'] = 'success';

      APP_STATE.configs['rendimentos_nome'] = 'Rendimentos';
      APP_STATE.configs['rendimentos_tipo'] = 'Receita';
      APP_STATE.configs['rendimentos_icon'] = 'trending-up';
      APP_STATE.configs['rendimentos_color'] = 'info';

      APP_STATE.configs['poupanca_nome'] = 'Poupança';
      APP_STATE.configs['poupanca_tipo'] = 'Poupança';
      APP_STATE.configs['poupanca_icon'] = 'piggy-bank';
      APP_STATE.configs['poupanca_color'] = 'primary';

      APP_STATE.configs['outros_nome'] = 'Outros';
      APP_STATE.configs['outros_tipo'] = 'Outros';
      APP_STATE.configs['outros_icon'] = 'layers';
      APP_STATE.configs['outros_color'] = 'secondary';
      configsChanged = true;
    }

    // Inicializar lista padrão de formas de pagamento caso seja a primeira vez
    if (APP_STATE.configs['formas_pagamento_lista'] === undefined) {
      APP_STATE.configs['formas_pagamento_lista'] = 'dinheiro,outros_banco';
      APP_STATE.configs['dinheiro_nome'] = 'Dinheiro em Espécie';
      APP_STATE.configs['dinheiro_icon'] = 'banknote';
      APP_STATE.configs['dinheiro_color'] = 'success';

      APP_STATE.configs['outros_banco_nome'] = 'Outra Conta Bancária';
      APP_STATE.configs['outros_banco_icon'] = 'landmark';
      APP_STATE.configs['outros_banco_color'] = 'info';
      configsChanged = true;
    }

    if (configsChanged) {
      await salvarConfiguracoes(APP_STATE.configs);
    }

    // Sincronizar chave do Gemini da planilha para o localStorage do navegador
    if (APP_STATE.configs['gemini_api_key']) {
      saveGeminiKey(APP_STATE.configs['gemini_api_key']);
      const geminiKeyInput = document.getElementById('settings-gemini-key');
      if (geminiKeyInput) {
        geminiKeyInput.value = APP_STATE.configs['gemini_api_key'];
      }
    }

    // Alimentar seletores de contas e filtros
    populateAccountSelectors(APP_STATE.configs);

    // 3. Atualizar elementos visuais
    updateDashboard(APP_STATE.transactions, APP_STATE.configs);
    renderTransactionsTable(APP_STATE.transactions);
    renderSettingsForm(APP_STATE.configs);
    renderCategoriesList(APP_STATE.configs);
    renderCategoriesSettingsForm(APP_STATE.configs);
    renderPaymentsList(APP_STATE.configs);
    renderPaymentsSettingsForm(APP_STATE.configs);

    // Salvar data de sincronização na UI
    const syncTimeEl = document.getElementById('settings-last-sync');
    if (syncTimeEl) {
      syncTimeEl.innerText = new Date().toLocaleTimeString('pt-BR') + ' - ' + new Date().toLocaleDateString('pt-BR');
    }

  } catch (error) {
    console.error('Falha ao sincronizar dados:', error);
    showToast(error.message || 'Erro ao sincronizar dados com o Google Drive.', 'error');
    
    const statusBadge = document.getElementById('settings-connection-status');
    if (statusBadge) {
      statusBadge.innerText = 'Erro de Conexão';
      statusBadge.className = 'badge badge-danger';
    }
  } finally {
    hideLoading();
  }
}

// Inicialização Geral
// NOTA: scripts type="module" são sempre diferidos (deferred), o DOM já está
// pronto quando o módulo executa — não precisamos de DOMContentLoaded.
(() => {
  // Inicializar ícones do Lucide (aguarda o CDN carregar se necessário)
  function initLucide(attemptsLeft) {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    } else if (attemptsLeft > 0) {
      setTimeout(() => initLucide(attemptsLeft - 1), 100);
    } else {
      console.warn('Lucide Icons não pôde ser carregado.');
    }
  }
  initLucide(30); // tenta por até 3 segundos

  // Vincular eventos de Login e Logout
  document.getElementById('btn-login').addEventListener('click', () => {
    login();
  });
  
  document.getElementById('btn-logout').addEventListener('click', logout);

  // Inicializar Módulo de UI e vincular Callbacks
  initUI({
    onTransactionsTabOpen: () => {
      // Atualizar tabela sempre que entrar na aba de transações
      renderTransactionsTable(APP_STATE.transactions);
    },
    
    onThemeChange: () => {
      // Redesenhar dashboard ao alternar tema para atualizar cores dos gráficos
      updateDashboard(APP_STATE.transactions, APP_STATE.configs);
    },
    
    onAddTransaction: async (tx) => {
      showLoading('Salvando transação na sua planilha...');
      try {
        await adicionarTransacao(tx);
        
        // Recarregar dados para manter sincronia perfeita
        const transactions = await carregarTransacoes();
        APP_STATE.transactions = transactions;
        
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderTransactionsTable(APP_STATE.transactions);
      } catch (error) {
        console.error('Erro ao adicionar transação:', error);
        showToast('Erro ao salvar transação: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },
    
    onUpdateTransaction: async (id, tx) => {
      showLoading('Atualizando lançamento na sua planilha...');
      try {
        await atualizarTransacao(id, tx);
        
        // Recarregar dados para manter sincronia perfeita
        const transactions = await carregarTransacoes();
        APP_STATE.transactions = transactions;
        
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderTransactionsTable(APP_STATE.transactions);
        showToast('Lançamento atualizado com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao atualizar transação:', error);
        showToast('Erro ao atualizar lançamento: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },

    onDeleteTransaction: async (id) => {
      showLoading('Excluindo lançamento da sua planilha...');
      try {
        await excluirTransacao(id);
        
        // Recarregar dados para manter sincronia perfeita
        const transactions = await carregarTransacoes();
        APP_STATE.transactions = transactions;
        
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderTransactionsTable(APP_STATE.transactions);
        showToast('Lançamento excluído com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao excluir transação:', error);
        showToast('Erro ao excluir lançamento: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },
    
    onSaveSettings: async (novasConfigs) => {
      showLoading('Salvando limites de cartão...');
      try {
        await salvarConfiguracoes(novasConfigs);
        
        // Recarregar configurações atualizadas
        const configs = await carregarConfiguracoes();
        APP_STATE.configs = configs;
        
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderSettingsForm(APP_STATE.configs);
        showToast('Configurações salvas com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showToast('Erro ao salvar limites: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },

    onAddCard: async (newCard) => {
      showLoading('Adicionando novo cartão...');
      try {
        // Normalizar ID do cartão (remover acentos e caracteres especiais)
        let cardId = newCard.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
        if (!cardId) cardId = 'cartao_' + Date.now();
        if (APP_STATE.configs[`${cardId}_limite`] !== undefined) {
          cardId += '_' + Date.now().toString().slice(-4);
        }

        const cardListStr = APP_STATE.configs['cartoes_lista'] || '';
        const cardList = cardListStr.split(',').filter(x => x.trim() !== '');
        cardList.push(cardId);

        // Atualizar configurações em memória
        APP_STATE.configs['cartoes_lista'] = cardList.join(',');
        APP_STATE.configs[`${cardId}_nome`] = newCard.name;
        APP_STATE.configs[`${cardId}_limite`] = String(newCard.limit);
        APP_STATE.configs[`${cardId}_fechamento`] = String(newCard.closing);
        APP_STATE.configs[`${cardId}_vencimento`] = String(newCard.due);

        // Gravar tudo no Google Sheets
        await salvarConfiguracoes(APP_STATE.configs);

        // Recarregar configs para perfeita sincronia
        const configs = await carregarConfiguracoes();
        APP_STATE.configs = configs;

        // Atualizar UI
        populateAccountSelectors(APP_STATE.configs);
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderSettingsForm(APP_STATE.configs);
        showToast('Cartão adicionado com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao adicionar cartão:', error);
        showToast('Erro ao adicionar cartão: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },

    onDeleteCard: async (cardId) => {
      showLoading('Excluindo cartão...');
      try {
        const cardListStr = APP_STATE.configs['cartoes_lista'] || '';
        let cardList = cardListStr.split(',').filter(x => x.trim() !== '');
        cardList = cardList.filter(id => id !== cardId);

        // Atualizar lista em memória
        APP_STATE.configs['cartoes_lista'] = cardList.join(',');

        // Salvar a nova lista no Sheets
        await salvarConfiguracoes({ cartoes_lista: APP_STATE.configs['cartoes_lista'] });

        // Recarregar configs
        const configs = await carregarConfiguracoes();
        APP_STATE.configs = configs;

        // Atualizar UI
        populateAccountSelectors(APP_STATE.configs);
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderSettingsForm(APP_STATE.configs);
      } catch (error) {
        console.error('Erro ao excluir cartão:', error);
        showToast('Erro ao excluir cartão: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },

    onSaveCategories: async (updatedCategories) => {
      showLoading('Salvando categorias...');
      try {
        await salvarConfiguracoes(updatedCategories);
        
        // Recarregar configurações atualizadas
        const configs = await carregarConfiguracoes();
        APP_STATE.configs = configs;
        
        // Atualizar UI
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderCategoriesList(APP_STATE.configs);
        renderCategoriesSettingsForm(APP_STATE.configs);
        showToast('Categorias salvas com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao salvar categorias:', error);
        showToast('Erro ao salvar categorias: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },

    onAddCategory: async (newCat) => {
      showLoading('Adicionando nova categoria...');
      try {
        // Normalizar ID da categoria (remover acentos e caracteres especiais)
        let catId = newCat.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
        if (!catId) catId = 'cat_' + Date.now();
        if (APP_STATE.configs[`${catId}_nome`] !== undefined) {
          catId += '_' + Date.now().toString().slice(-4);
        }

        const catListStr = APP_STATE.configs['categorias_lista'] || '';
        const catList = catListStr.split(',').filter(x => x.trim() !== '');
        catList.push(catId);

        // Atualizar configs em memória
        APP_STATE.configs['categorias_lista'] = catList.join(',');
        APP_STATE.configs[`${catId}_nome`] = newCat.name;
        APP_STATE.configs[`${catId}_tipo`] = newCat.type;
        APP_STATE.configs[`${catId}_icon`] = newCat.icon;
        APP_STATE.configs[`${catId}_color`] = newCat.color;

        // Gravar tudo no Google Sheets
        await salvarConfiguracoes(APP_STATE.configs);

        // Recarregar configs
        const configs = await carregarConfiguracoes();
        APP_STATE.configs = configs;

        // Atualizar UI
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderCategoriesList(APP_STATE.configs);
        renderCategoriesSettingsForm(APP_STATE.configs);
        showToast('Categoria adicionada com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao adicionar categoria:', error);
        showToast('Erro ao adicionar categoria: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },

    onDeleteCategory: async (catId) => {
      showLoading('Excluindo categoria...');
      try {
        const catListStr = APP_STATE.configs['categorias_lista'] || '';
        let catList = catListStr.split(',').filter(x => x.trim() !== '');
        catList = catList.filter(id => id !== catId);

        // Atualizar lista em memória
        APP_STATE.configs['categorias_lista'] = catList.join(',');

        // Salvar a nova lista no Sheets
        await salvarConfiguracoes({ categorias_lista: APP_STATE.configs['categorias_lista'] });

        // Recarregar configs
        const configs = await carregarConfiguracoes();
        APP_STATE.configs = configs;

        // Atualizar UI
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderCategoriesList(APP_STATE.configs);
        renderCategoriesSettingsForm(APP_STATE.configs);
        showToast('Categoria excluída com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        showToast('Erro ao excluir categoria: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },

    onSavePayments: async (updatedPayments) => {
      showLoading('Salvando formas de pagamento...');
      try {
        await salvarConfiguracoes(updatedPayments);
        
        // Recarregar configurações atualizadas
        const configs = await carregarConfiguracoes();
        APP_STATE.configs = configs;
        
        // Atualizar UI
        populateAccountSelectors(APP_STATE.configs);
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderPaymentsList(APP_STATE.configs);
        renderPaymentsSettingsForm(APP_STATE.configs);
        showToast('Formas de pagamento salvas com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao salvar formas de pagamento:', error);
        showToast('Erro ao salvar formas de pagamento: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },

    onAddPayment: async (newPay) => {
      showLoading('Adicionando nova forma de pagamento...');
      try {
        // Normalizar ID da forma de pagamento
        let payId = newPay.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
        if (!payId) payId = 'pay_' + Date.now();
        if (APP_STATE.configs[`${payId}_nome`] !== undefined) {
          payId += '_' + Date.now().toString().slice(-4);
        }

        const payListStr = APP_STATE.configs['formas_pagamento_lista'] || '';
        const payList = payListStr.split(',').filter(x => x.trim() !== '');
        payList.push(payId);

        // Atualizar configs em memória
        APP_STATE.configs['formas_pagamento_lista'] = payList.join(',');
        APP_STATE.configs[`${payId}_nome`] = newPay.name;
        APP_STATE.configs[`${payId}_icon`] = newPay.icon;
        APP_STATE.configs[`${payId}_color`] = newPay.color;

        // Gravar tudo no Google Sheets
        await salvarConfiguracoes(APP_STATE.configs);

        // Recarregar configs
        const configs = await carregarConfiguracoes();
        APP_STATE.configs = configs;

        // Atualizar UI
        populateAccountSelectors(APP_STATE.configs);
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderPaymentsList(APP_STATE.configs);
        renderPaymentsSettingsForm(APP_STATE.configs);
        showToast('Forma de pagamento adicionada com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao adicionar forma de pagamento:', error);
        showToast('Erro ao adicionar forma de pagamento: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },

    onDeletePayment: async (payId) => {
      showLoading('Excluindo forma de pagamento...');
      try {
        const payListStr = APP_STATE.configs['formas_pagamento_lista'] || '';
        let payList = payListStr.split(',').filter(x => x.trim() !== '');
        payList = payList.filter(id => id !== payId);

        // Atualizar lista em memória
        APP_STATE.configs['formas_pagamento_lista'] = payList.join(',');

        // Salvar a nova lista no Sheets
        await salvarConfiguracoes({ formas_pagamento_lista: APP_STATE.configs['formas_pagamento_lista'] });

        // Recarregar configs
        const configs = await carregarConfiguracoes();
        APP_STATE.configs = configs;

        // Atualizar UI
        populateAccountSelectors(APP_STATE.configs);
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderPaymentsList(APP_STATE.configs);
        renderPaymentsSettingsForm(APP_STATE.configs);
        showToast('Forma de pagamento excluída com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao excluir forma de pagamento:', error);
        showToast('Erro ao excluir forma de pagamento: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },
    
    onFilterChange: () => {
      renderTransactionsTable(APP_STATE.transactions);
    },

    onPeriodChange: () => {
      updateDashboard(APP_STATE.transactions, APP_STATE.configs);
    },

    onAddRecurringSalary: async (salaryData) => {
      const { startDate, frequency, value, occurrences, account, description } = salaryData;

      // Gerar lançamentos recorrentes
      const transactionsToAdd = [];
      const baseDate = new Date(startDate + 'T12:00:00');
      for (let i = 0; i < occurrences; i++) {
        const nextDate = new Date(baseDate);
        if (frequency === 'Semanal') {
          nextDate.setDate(baseDate.getDate() + (i * 7));
        } else if (frequency === 'Quinzenal') {
          nextDate.setDate(baseDate.getDate() + (i * 14));
        } else {
          // Mensal
          nextDate.setMonth(baseDate.getMonth() + i);
        }

        const yyyy = nextDate.getFullYear();
        const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
        const dd = String(nextDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        transactionsToAdd.push({
          date: dateStr,
          type: 'Receita',
          category: 'Salário',
          value: value,
          account: account,
          description: occurrences > 1 ? `${description} (${i + 1}/${occurrences})` : description
        });
      }

      showLoading(`Lançando ${occurrences} salários recorrentes...`);
      try {
        await adicionarTransacoesEmLote(transactionsToAdd);

        // Recarregar do sheets
        const transactions = await carregarTransacoes();
        APP_STATE.transactions = transactions;

        // Limpar o filtro de pesquisa para garantir que os salários apareçam
        const filterSearch = document.getElementById('filter-search');
        if (filterSearch) {
          filterSearch.value = '';
        }

        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderTransactionsTable(APP_STATE.transactions);
        showToast(`${occurrences} lançamentos de salário registrados com sucesso!`, 'success');
      } catch (error) {
        console.error('Erro ao adicionar salário recorrente:', error);
        showToast('Erro ao salvar os lançamentos de salário: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },
    
    onSyncNow: async () => {
      await sincronizarDados();
    },
    
    onSwitchAccount: () => {
      logout();
      login();
    },

    onSaveGeminiKey: async (key) => {
      saveGeminiKey(key);
      showLoading('Salvando chave do Gemini na planilha...');
      try {
        APP_STATE.configs['gemini_api_key'] = key;
        await salvarConfiguracoes({ gemini_api_key: key });
        showToast('Chave de API do Gemini salva e sincronizada com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao salvar chave do Gemini na planilha:', error);
        showToast('Chave salva no navegador, mas houve um erro ao sincronizar com o Drive: ' + error.message, 'warning');
      } finally {
        hideLoading();
      }
    },

    onSelectGoogleAvatar: async (avatarUrl) => {
      showLoading('Sincronizando foto de perfil com a planilha...');
      try {
        // Converter a URL para base64 para evitar expiração do link do Google
        let finalAvatar = avatarUrl;
        try {
          finalAvatar = await converterUrlImagemParaBase64(avatarUrl);
        } catch (convErr) {
          console.warn('Não foi possível converter a imagem do Google para Base64:', convErr);
          // Fallback: usar a URL original (se falhar o CORS)
        }

        const customUserStr = localStorage.getItem('controlator_custom_user_info');
        let customInfo = customUserStr ? JSON.parse(customUserStr) : { name: 'Usuário', avatar: '' };
        customInfo.avatar = finalAvatar;
        localStorage.setItem('controlator_custom_user_info', JSON.stringify(customInfo));

        await salvarPerfil({
          avatar_usuario: finalAvatar
        });

        const savedUserStr = localStorage.getItem('controlator_user_info');
        const authUser = savedUserStr ? JSON.parse(savedUserStr) : { name: 'Usuário', avatar: '' };
        updateUserInfo(authUser);
        showToast('Foto do Google selecionada e salva com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao salvar foto de perfil na planilha:', error);
        showToast('Erro ao sincronizar foto de perfil: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    },

    onSaveProfile: async (perfilData) => {
      showLoading('Sincronizando perfil com a planilha...');
      try {
        const customInfo = {
          name: perfilData.name,
          avatar: perfilData.avatar || ''
        };
        localStorage.setItem('controlator_custom_user_info', JSON.stringify(customInfo));

        await salvarPerfil({
          nome_usuario: perfilData.name,
          avatar_usuario: perfilData.avatar || ''
        });

        const savedUserStr = localStorage.getItem('controlator_user_info');
        const authUser = savedUserStr ? JSON.parse(savedUserStr) : { name: 'Usuário', avatar: '' };
        updateUserInfo(authUser);
        showToast('Perfil atualizado e sincronizado com sucesso!', 'success');
      } catch (error) {
        console.error('Erro ao salvar perfil na planilha:', error);
        showToast('Perfil salvo localmente, mas houve um erro ao sincronizar com o Drive: ' + error.message, 'warning');
      } finally {
        hideLoading();
      }
    },

    onProcessInvoiceFile: async (file, apiKey) => {
      try {
        const texto = await extrairTextoDoPDF(file);
        const transacoes = await processarFaturaComGemini(texto, apiKey);
        renderImportedTransactions(transacoes);
      } catch (error) {
        console.error('Falha na extração por IA:', error);
        throw error;
      }
    },

    onConfirmImport: async (selectedTxs) => {
      showLoading(`Salvando ${selectedTxs.length} transações no Google Sheets...`);
      try {
        // Salvar em lote
        await adicionarTransacoesEmLote(selectedTxs);
        
        // Recarregar transações do sheets
        const transactions = await carregarTransacoes();
        APP_STATE.transactions = transactions;
        
        // Atualizar Dashboard e Histórico
        updateDashboard(APP_STATE.transactions, APP_STATE.configs);
        renderTransactionsTable(APP_STATE.transactions);
        
        showToast(`${selectedTxs.length} transações registradas com sucesso!`, 'success');
      } catch (error) {
        console.error('Erro ao registrar importações:', error);
        showToast('Erro ao salvar as transações: ' + error.message, 'error');
      } finally {
        hideLoading();
      }
    }
  });

  // Inicializar autenticação Google (aguardando o carregamento do SDK)
  function inicializarQuandoGoogleCarregar() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      initAuth(handleAuthChange);
    } else {
      setTimeout(inicializarQuandoGoogleCarregar, 100);
    }
  }
  inicializarQuandoGoogleCarregar();
})();
