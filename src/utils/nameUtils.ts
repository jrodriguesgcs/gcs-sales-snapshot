export function cleanOwnerName(fullName: string): string {
  if (!fullName) return '';
  
  // Split by " | " and take first part
  const parts = fullName.split('|');
  return parts[0].trim();
}

export function shouldExcludeOwner(fullName: string, ownerId?: string): boolean {
  // Exclude "Global Citizen Solutions Operator" or user ID 16
  if (ownerId === '16') return true;
  
  const cleanName = fullName.toLowerCase();
  return cleanName.includes('global citizen solutions operator');
}