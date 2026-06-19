/* MÓDULO DE INTEGRAÇÃO - GOOGLE SHEETS & DRIVE API */
import { getAccessToken, logout } from './auth.js';

let activeSpreadsheetId = null;

// Função auxiliar para fazer requisições HTTP autenticadas para as APIs do Google
async function googleRequest(url, options = {}) {
  const token = getAccessToken();
  if (!token) {
    logout();
    throw new Error('Usuário não autenticado no Google.');
  }

  // Mesclar headers
  options.headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const response = await fetch(url, options);

  if (response.status === 401) {
    // Token expirado ou inválido
    logout();
    throw new Error('Sessão expirada. Por favor, conecte sua conta Google novamente.');
  }

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error(`Erro na requisição para ${url}:`, errorDetails);
    throw new Error(`Erro na API do Google (${response.status}): ${response.statusText}`);
  }

  return response.json();
}

/**
 * Busca a planilha Controlator_BD no Drive. Se não existir, cria uma com o layout correto.
 * @returns {Promise<string>} O ID da planilha do Google Sheets
 */
export async function buscarOuCriarPlanilha() {
  const cachedId = localStorage.getItem('controlator_spreadsheet_id');
  
  // 1. Buscar ou criar a pasta "Controlator" no Google Drive
  let folderId = null;
  try {
    const folderQuery = encodeURIComponent("name = 'Controlator' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const folderSearchUrl = `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&fields=files(id,name)`;
    const folderSearchResult = await googleRequest(folderSearchUrl);
    
    if (folderSearchResult.files && folderSearchResult.files.length > 0) {
      folderId = folderSearchResult.files[0].id;
    } else {
      console.log('Pasta Controlator não encontrada. Criando...');
      const createFolderUrl = 'https://www.googleapis.com/drive/v3/files';
      const folderMeta = await googleRequest(createFolderUrl, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Controlator',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      folderId = folderMeta.id;
    }
  } catch (error) {
    console.error('Erro ao buscar/criar pasta no Drive:', error);
  }

  if (cachedId) {
    // Verificar se a planilha salva em cache ainda existe e está acessível
    try {
      await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${cachedId}`);
      activeSpreadsheetId = cachedId;
      
      // Garantir que a planilha em cache esteja organizada dentro da pasta
      if (folderId) {
        await garantirPlanilhaNaPasta(cachedId, folderId);
      }
      
      return cachedId;
    } catch (e) {
      console.warn('Planilha do cache não está acessível, buscando de novo no Drive...');
      localStorage.removeItem('controlator_spreadsheet_id');
    }
  }

  // 2. Procurar planilha pelo nome no Google Drive
  const query = encodeURIComponent("name = 'Controlator_BD' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,parents)`;
  
  const searchResult = await googleRequest(driveUrl);
  
  if (searchResult.files && searchResult.files.length > 0) {
    const file = searchResult.files[0];
    activeSpreadsheetId = file.id;
    localStorage.setItem('controlator_spreadsheet_id', activeSpreadsheetId);
    
    // Garantir que a planilha existente esteja organizada dentro da pasta
    if (folderId) {
      await garantirPlanilhaNaPasta(activeSpreadsheetId, folderId, file.parents);
    }
    
    return activeSpreadsheetId;
  }

  // 3. Criar planilha se não existir
  console.log('Planilha de banco de dados não encontrada. Criando uma nova...');
  const sheetsUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = {
    properties: {
      title: 'Controlator_BD'
    },
    sheets: [
      { properties: { title: 'Transacoes' } },
      { properties: { title: 'Configuracoes' } },
      { properties: { title: 'Perfil' } }
    ]
  };

  const newSheet = await googleRequest(sheetsUrl, {
    method: 'POST',
    body: JSON.stringify(body)
  });

  activeSpreadsheetId = newSheet.spreadsheetId;
  localStorage.setItem('controlator_spreadsheet_id', activeSpreadsheetId);

  // Mover para a pasta Controlator recém-criada
  if (folderId) {
    try {
      const sheetMeta = await googleRequest(`https://www.googleapis.com/drive/v3/files/${activeSpreadsheetId}?fields=parents`);
      await garantirPlanilhaNaPasta(activeSpreadsheetId, folderId, sheetMeta.parents);
    } catch (error) {
      console.error('Erro ao mover a nova planilha para a pasta:', error);
    }
  }

  // 4. Inicializar abas com cabeçalhos e configurações iniciais padrão
  await inicializarPlanilhaEstrutura(activeSpreadsheetId);

  return activeSpreadsheetId;
}

/**
 * Certifica que a planilha está dentro da pasta Controlator.
 * Se não estiver, move para lá.
 * @param {string} sheetId - ID da planilha
 * @param {string} folderId - ID da pasta de destino
 * @param {Array} currentParents - Lista atual de pastas-mãe (opcional)
 */
async function garantirPlanilhaNaPasta(sheetId, folderId, currentParents = null) {
  try {
    let parents = currentParents;
    if (!parents) {
      const fileMeta = await googleRequest(`https://www.googleapis.com/drive/v3/files/${sheetId}?fields=parents`);
      parents = fileMeta.parents || [];
    }
    
    // Se a planilha já está dentro da pasta, encerra
    if (parents.includes(folderId)) {
      return;
    }
    
    console.log('Planilha encontrada fora da pasta Controlator. Organizando e movendo...');
    const oldParentsStr = parents.join(',');
    const moveUrl = `https://www.googleapis.com/drive/v3/files/${sheetId}?addParents=${folderId}&removeParents=${oldParentsStr}`;
    
    await googleRequest(moveUrl, {
      method: 'PATCH',
      body: JSON.stringify({})
    });
    console.log('Planilha movida com sucesso para a pasta Controlator!');
  } catch (error) {
    console.error('Erro ao mover planilha para a pasta:', error);
  }
}

export function getSpreadsheetId() {
  return activeSpreadsheetId;
}

/**
 * Cria os cabeçalhos padrão na planilha recém-criada
 */
async function inicializarPlanilhaEstrutura(spreadsheetId) {
  // Inicializar Aba de Transações
  const transacoesHeaders = [['ID', 'Data', 'Tipo', 'Categoria', 'Valor', 'Meio de Pagamento', 'Descrição']];
  await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transacoes!A1:G1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: transacoesHeaders })
  });

  // Inicializar Aba de Configurações
  const configValues = [
    ['Chave', 'Valor'],
    ['nubank_limite', '5950.00'],
    ['nubank_fechamento', '6'],
    ['nubank_vencimento', '15'],
    ['bb_limite', '1743.00'],
    ['bb_fechamento', '3'],
    ['bb_vencimento', '13'],
    ['mp_limite', '4000.00'],
    ['mp_fechamento', '9'],
    ['mp_vencimento', '15']
  ];
  await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Configuracoes!A1:B11?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: configValues })
  });

  // Inicializar Aba de Perfil
  const perfilHeaders = [['Chave', 'Valor']];
  await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Perfil!A1:B1?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: perfilHeaders })
  });
}

/**
 * Carrega todos os lançamentos (Transações) do Google Sheets
 * @returns {Promise<Array>} Lista de objetos de transação formatados
 */
export async function carregarTransacoes() {
  if (!activeSpreadsheetId) await buscarOuCriarPlanilha();
  
  const response = await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/Transacoes!A:G`);
  
  const rows = response.values || [];
  if (rows.length <= 1) return []; // Somente cabeçalho ou vazio

  // Converter matriz de dados em objetos chave-valor
  const headers = rows[0];
  const dataRows = rows.slice(1);

  return dataRows.map(row => {
    return {
      id: row[0] || '',
      date: row[1] || '',
      type: row[2] || '',
      category: row[3] || '',
      value: Number((row[4] || '0').replace('.', '').replace(',', '.')) || 0,
      account: row[5] || '',
      description: row[6] || ''
    };
  });
}

/**
 * Carrega as configurações (limites e datas de corte) da planilha
 * @returns {Promise<Object>} Dicionário de configurações chave-valor
 */
export async function carregarConfiguracoes() {
  if (!activeSpreadsheetId) await buscarOuCriarPlanilha();

  const response = await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/Configuracoes!A:B`);
  
  const rows = response.values || [];
  const configs = {};
  
  // Ignorar cabeçalho (linha 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[0]) {
      configs[row[0]] = row[1];
    }
  }
  
  return configs;
}

/**
 * Adiciona uma nova transação à planilha do Google Sheets
 * @param {Object} tx - Objeto contendo data, tipo, categoria, valor, meio e descrição
 */
export async function adicionarTransacao(tx) {
  if (!activeSpreadsheetId) await buscarOuCriarPlanilha();

  const id = 'tx_' + Date.now();
  // Formatar valor usando ponto decimal para o Sheets interpretar como número
  const valueFormatted = String(tx.value).replace(',', '.');
  
  const values = [[id, tx.date, tx.type, tx.category, valueFormatted, tx.account, tx.description]];
  
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/Transacoes!A1:G1:append?valueInputOption=USER_ENTERED`;
  
  await googleRequest(url, {
    method: 'POST',
    body: JSON.stringify({ values })
  });

  return id;
}

/**
 * Adiciona múltiplas transações de uma vez (em lote) à planilha do Google Sheets
 * @param {Array} listaTx - Lista de objetos de transação
 * @returns {Promise<Array>} Lista de IDs das transações criadas
 */
export async function adicionarTransacoesEmLote(listaTx) {
  if (!activeSpreadsheetId) await buscarOuCriarPlanilha();
  if (!listaTx || listaTx.length === 0) return [];

  const timestamp = Date.now();
  const values = listaTx.map((tx, idx) => {
    const id = `tx_${timestamp}_${idx}`;
    const valueFormatted = String(tx.value).replace(',', '.');
    return [id, tx.date, tx.type, tx.category, valueFormatted, tx.account, tx.description];
  });

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/Transacoes!A1:G1:append?valueInputOption=USER_ENTERED`;
  
  await googleRequest(url, {
    method: 'POST',
    body: JSON.stringify({ values })
  });

  return values.map(v => v[0]);
}

/**
 * Atualiza múltiplas chaves de configuração na aba de Configurações
 * @param {Object} novasConfigs - Objeto chave-valor contendo os dados a atualizar
 */
export async function salvarConfiguracoes(novasConfigs) {
  if (!activeSpreadsheetId) await buscarOuCriarPlanilha();

  // 1. Carregar as configurações atuais para identificar as linhas
  const response = await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/Configuracoes!A:B`);
  const rows = response.values || [];

  // Criar uma matriz com o cabeçalho
  const updatedRows = [['Chave', 'Valor']];
  
  // Mapear chaves existentes e atualizá-las, ou manter as não modificadas
  const keysProcessed = new Set();
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[0]) {
      const key = row[0];
      const val = novasConfigs[key] !== undefined ? String(novasConfigs[key]) : row[1];
      updatedRows.push([key, val]);
      keysProcessed.add(key);
    }
  }

  // Adicionar chaves novas se houver alguma
  for (const [key, value] of Object.entries(novasConfigs)) {
    if (!keysProcessed.has(key)) {
      updatedRows.push([key, String(value)]);
    }
  }

  // Gravar tudo de volta (sobrescrevendo o range total)
  const range = `Configuracoes!A1:B${updatedRows.length}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  
  await googleRequest(url, {
    method: 'PUT',
    body: JSON.stringify({ values: updatedRows })
  });
}

/**
 * Garante que a aba 'Perfil' existe na planilha ativa.
 * Útil para usuários que já criaram a planilha antes desta atualização.
 */
async function garantirAbaPerfil() {
  const metadata = await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}`);
  const sheets = metadata.sheets || [];
  const perfilExiste = sheets.some(s => s.properties.title === 'Perfil');
  
  if (!perfilExiste) {
    console.log('Aba Perfil não encontrada na planilha. Criando...');
    // Criar a aba via batchUpdate
    await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: 'Perfil'
              }
            }
          }
        ]
      })
    });
    
    // Inicializar cabeçalho
    await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/Perfil!A1:B1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [['Chave', 'Valor']] })
    });
  }
}

/**
 * Carrega as informações de perfil da planilha.
 * @returns {Promise<Object>} Objeto contendo nome e avatar se existirem
 */
export async function carregarPerfil() {
  if (!activeSpreadsheetId) await buscarOuCriarPlanilha();
  
  await garantirAbaPerfil();

  try {
    const response = await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/Perfil!A:B`);
    const rows = response.values || [];
    const perfil = {};
    
    // Ignorar cabeçalho (linha 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row[0]) {
        perfil[row[0]] = row[1];
      }
    }
    
    return perfil;
  } catch (error) {
    console.error('Erro ao carregar perfil:', error);
    return {};
  }
}

/**
 * Salva as informações de perfil na planilha.
 * @param {Object} novoPerfil - Dicionário contendo os dados a atualizar (ex: nome_usuario, avatar_usuario)
 */
export async function salvarPerfil(novoPerfil) {
  if (!activeSpreadsheetId) await buscarOuCriarPlanilha();
  
  await garantirAbaPerfil();

  // 1. Carregar as configurações atuais do perfil para identificar as linhas
  const response = await googleRequest(`https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/Perfil!A:B`);
  const rows = response.values || [];

  // Criar uma matriz com o cabeçalho
  const updatedRows = [['Chave', 'Valor']];
  const keysProcessed = new Set();
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && row[0]) {
      const key = row[0];
      const val = novoPerfil[key] !== undefined ? String(novoPerfil[key]) : row[1];
      updatedRows.push([key, val]);
      keysProcessed.add(key);
    }
  }

  // Adicionar chaves novas se houver alguma
  for (const [key, value] of Object.entries(novoPerfil)) {
    if (!keysProcessed.has(key)) {
      updatedRows.push([key, String(value)]);
    }
  }

  // Gravar tudo de volta (sobrescrevendo o range total)
  const range = `Perfil!A1:B${updatedRows.length}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${activeSpreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  
  await googleRequest(url, {
    method: 'PUT',
    body: JSON.stringify({ values: updatedRows })
  });
}
