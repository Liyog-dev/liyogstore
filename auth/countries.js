// ============================
// Country & State Data
// ============================
export const countries = [
  {
    name: "United States",
    code: "US",
    states: [
      "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
      "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
      "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
      "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
      "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
      "New Hampshire", "New Jersey", "New Mexico", "New York",
      "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
      "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
      "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
      "West Virginia", "Wisconsin", "Wyoming"
    ]
  },
  {
    name: "Canada",
    code: "CA",
    states: [
      "Alberta", "British Columbia", "Manitoba", "New Brunswick",
      "Newfoundland and Labrador", "Nova Scotia", "Ontario",
      "Prince Edward Island", "Quebec", "Saskatchewan"
    ]
  },
  {
    name: "United Kingdom",
    code: "GB",
    states: [
      "England", "Scotland", "Wales", "Northern Ireland"
    ]
  },
  {
    name: "Australia",
    code: "AU",
    states: [
      "New South Wales", "Queensland", "South Australia",
      "Tasmania", "Victoria", "Western Australia", "Australian Capital Territory", "Northern Territory"
    ]
  },
  {
    name: "India",
    code: "IN",
    states: [
      "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
      "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
      "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
      "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
      "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
      "Uttarakhand", "West Bengal", "Delhi", "Puducherry", "Chandigarh"
    ]
  },
  // Add more countries below (100+ list can be expanded)
  { name: "Germany", code: "DE", states: ["Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse", "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia", "Rhineland-Palatinate", "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia"] },
  { name: "France", code: "FR", states: ["Île-de-France", "Provence-Alpes-Côte d'Azur", "Nouvelle-Aquitaine", "Occitanie", "Auvergne-Rhône-Alpes", "Brittany", "Normandy", "Hauts-de-France", "Pays de la Loire", "Centre-Val de Loire", "Corsica"] },
  { name: "Nigeria", code: "NG", states: ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "FCT"] },
  { name: "Brazil", code: "BR", states: ["Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"] },
  { name: "Japan", code: "JP", states: ["Hokkaido", "Tohoku", "Kanto", "Chubu", "Kinki", "Chugoku", "Shikoku", "Kyushu"] }
  // ... continue adding until you hit 100+ entries
];

// ============================
// Populate Country Select
// ============================
export function populateCountries(selectEl) {
  selectEl.innerHTML = '<option value="">Select Country</option>';
  countries.forEach(country => {
    const opt = document.createElement('option');
    opt.value = country.code;
    opt.textContent = country.name;
    selectEl.appendChild(opt);
  });
}

// ============================
// Populate State Select
// ============================
export function populateStates(selectEl, countryCode) {
  selectEl.innerHTML = '<option value="">Select State/Province</option>';
  const country = countries.find(c => c.code === countryCode);
  if (country && country.states) {
    country.states.forEach(state => {
      const opt = document.createElement('option');
      opt.value = state;
      opt.textContent = state;
      selectEl.appendChild(opt);
    });
  }
}
