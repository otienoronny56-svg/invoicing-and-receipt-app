export const STORAGE_KEY_COMPANIES = 'invoice_app_companies';
export const STORAGE_KEY_INVOICES = 'invoice_app_invoices';

export const getCompanies = () => {
  const data = localStorage.getItem(STORAGE_KEY_COMPANIES);
  return data ? JSON.parse(data) : [];
};

export const saveCompany = (company) => {
  const companies = getCompanies();
  const existingIndex = companies.findIndex(c => c.id === company.id);
  
  if (existingIndex >= 0) {
    companies[existingIndex] = company;
  } else {
    companies.push(company);
  }
  
  localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(companies));
  return companies;
};

export const getInvoices = (companyId) => {
  const data = localStorage.getItem(STORAGE_KEY_INVOICES);
  let invoices = data ? JSON.parse(data) : [];
  if (companyId) {
    invoices = invoices.filter(i => i.companyId === companyId);
  }
  return invoices;
};

export const saveInvoice = (invoice) => {
  const data = localStorage.getItem(STORAGE_KEY_INVOICES);
  const invoices = data ? JSON.parse(data) : [];
  
  const existingIndex = invoices.findIndex(i => i.id === invoice.id);
  if (existingIndex >= 0) {
    invoices[existingIndex] = invoice;
  } else {
    invoices.push(invoice);
  }
  
  localStorage.setItem(STORAGE_KEY_INVOICES, JSON.stringify(invoices));
  return invoices;
};

export const deleteInvoice = (id) => {
  const data = localStorage.getItem(STORAGE_KEY_INVOICES);
  let invoices = data ? JSON.parse(data) : [];
  invoices = invoices.filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY_INVOICES, JSON.stringify(invoices));
  return invoices;
};
