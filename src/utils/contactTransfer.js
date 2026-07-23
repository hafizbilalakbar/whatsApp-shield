const contactTransfer = {
  transferContactFromResult: (result, navigate) => {
    if (!result.exists) return;
    
    const contact = {
      phone: result.formatted,
      name: result.statusText || `User ${result.formatted.slice(-4)}`,
      country: result.detectedCountry || 'Unknown',
      avatar: result.avatar,
      about: result.statusText || '',
      exists: result.exists,
      source: 'whatsapp_shield'
    };
    
    navigate('/message-agent', {
      state: {
        selectedContact: contact,
        openConversation: true,
        fromSource: 'whatsapp_shield'
      }
    });
  },
  
  transferMultipleContacts: (results, navigate) => {
    const validContacts = results.filter(r => r.exists && r.isValidFormat);
    
    if (validContacts.length === 1) {
      contactTransfer.transferContactFromResult(validContacts[0], navigate);
    } else {
      const contacts = validContacts.map(result => ({
        phone: result.formatted,
        name: result.statusText || `User ${result.formatted.slice(-4)}`,
        country: result.detectedCountry || 'Unknown',
        avatar: result.avatar,
        about: result.statusText || '',
        exists: result.exists,
        source: 'whatsapp_shield'
      }));
      
      navigate('/message-agent', {
        state: {
          batchContacts: contacts,
          openFirst: true,
          fromSource: 'whatsapp_shield'
        }
      });
    }
  },
  
  getBatchContacts: () => {
    try {
      const stored = localStorage.getItem('messageAgent_batchContacts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },
  
  clearBatchContacts: () => {
    localStorage.removeItem('messageAgent_batchContacts');
  }
};

export default contactTransfer;
