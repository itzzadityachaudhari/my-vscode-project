import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const newToken = response.data.access_token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      toast.success('Logged in successfully!');
      return true;
    } catch (error) {
      toast.error('Login failed. Please check your credentials.');
      return false;
    }
  };

  const register = async (email, password, full_name) => {
    try {
      const response = await axios.post(`${API}/auth/register`, { email, password, full_name });
      const newToken = response.data.access_token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      toast.success('Account created successfully!');
      return true;
    } catch (error) {
      toast.error('Registration failed. Email might already be in use.');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully!');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

// Header Component
const Header = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">DH</span>
          </div>
          <span className="font-bold text-xl text-gray-900">DealHunt</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          <Link to="/" className="text-gray-600 hover:text-emerald-600 font-medium">
            Home
          </Link>
          <Link to="/categories" className="text-gray-600 hover:text-emerald-600 font-medium">
            Categories
          </Link>
          {isAuthenticated && (
            <Link to="/saved" className="text-gray-600 hover:text-emerald-600 font-medium">
              Saved Offers
            </Link>
          )}
          {user?.is_admin && (
            <Link to="/admin" className="text-gray-600 hover:text-emerald-600 font-medium">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-3">
          {isAuthenticated ? (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">Hi, {user?.full_name}</span>
              <Button onClick={logout} variant="outline" size="sm" data-testid="logout-button">
                Logout
              </Button>
            </div>
          ) : (
            <Dialog open={showAuth} onOpenChange={setShowAuth}>
              <DialogTrigger asChild>
                <Button data-testid="login-button">Login / Register</Button>
              </DialogTrigger>
              <DialogContent>
                <AuthDialog onClose={() => setShowAuth(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </header>
  );
};

// Auth Dialog Component
const AuthDialog = ({ onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', full_name: '' });
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = isLogin 
      ? await login(formData.email, formData.password)
      : await register(formData.email, formData.password, formData.full_name);
    
    if (success) {
      onClose();
    }
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle>{isLogin ? 'Login' : 'Create Account'}</DialogTitle>
        <DialogDescription>
          {isLogin ? 'Welcome back!' : 'Join DealHunt to save your favorite offers'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        {!isLogin && (
          <div>
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              data-testid="full-name-input"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              required
            />
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            data-testid="email-input"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            data-testid="password-input"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
          />
        </div>
        <Button type="submit" className="w-full" data-testid="auth-submit-button">
          {isLogin ? 'Login' : 'Create Account'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setIsLogin(!isLogin)}
          data-testid="auth-switch-button"
        >
          {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
        </Button>
      </form>
    </div>
  );
};

// Offer Card Component
const OfferCard = ({ offer, onSave, onUnsave, isSaved }) => {
  const { isAuthenticated } = useAuth();

  const handleSaveToggle = () => {
    if (isSaved) {
      onUnsave(offer.id);
    } else {
      onSave(offer.id);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(price);
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white shadow-md" data-testid="offer-card">
      <div className="relative overflow-hidden rounded-t-lg">
        <img
          src={offer.product_image}
          alt={offer.title}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-3 left-3">
          <Badge className="bg-red-500 hover:bg-red-600 text-white font-semibold">
            {offer.discount_percentage}% OFF
          </Badge>
        </div>
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="bg-white/90 text-gray-700">
            {offer.store}
          </Badge>
        </div>
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2">
          {offer.title}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600 line-clamp-2">
          {offer.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col">
            {offer.discounted_price && (
              <span className="text-xl font-bold text-emerald-600">
                {formatPrice(offer.discounted_price)}
              </span>
            )}
            {offer.original_price && (
              <span className="text-sm text-gray-500 line-through">
                {formatPrice(offer.original_price)}
              </span>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            {offer.category}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button
            asChild
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            data-testid="grab-deal-button"
          >
            <a href={offer.offer_link} target="_blank" rel="noopener noreferrer">
              Grab Deal
            </a>
          </Button>
          
          {isAuthenticated && (
            <Button
              variant={isSaved ? "default" : "outline"}
              size="sm"
              onClick={handleSaveToggle}
              data-testid="save-offer-button"
            >
              {isSaved ? '❤️' : '🤍'}
            </Button>
          )}
        </div>

        {offer.expiry_date && (
          <p className="text-xs text-gray-500 mt-2">
            Expires: {new Date(offer.expiry_date).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// Home Page Component
const HomePage = () => {
  const [offers, setOffers] = useState([]);
  const [filteredOffers, setFilteredOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [savedOffers, setSavedOffers] = useState(new Set());
  const { token, isAuthenticated } = useAuth();

  const stores = ['Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Meesho'];
  const categories = ['Electronics', 'Fashion', 'Home & Kitchen', 'Sports & Fitness', 'Books', 'Beauty'];

  useEffect(() => {
    fetchOffers();
    if (isAuthenticated) {
      fetchSavedOffers();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    filterOffers();
  }, [offers, searchTerm, selectedStore, selectedCategory]);

  const fetchOffers = async () => {
    try {
      const response = await axios.get(`${API}/offers`);
      setOffers(response.data);
    } catch (error) {
      toast.error('Failed to fetch offers');
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedOffers = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/users/saved-offers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSavedOffers(new Set(response.data.map(offer => offer.id)));
    } catch (error) {
      console.error('Failed to fetch saved offers');
    }
  };

  const handleSaveOffer = async (offerId) => {
    try {
      await axios.post(`${API}/offers/${offerId}/save`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSavedOffers(prev => new Set([...prev, offerId]));
      toast.success('Offer saved!');
    } catch (error) {
      toast.error('Failed to save offer');
    }
  };

  const handleUnsaveOffer = async (offerId) => {
    try {
      await axios.delete(`${API}/offers/${offerId}/save`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSavedOffers(prev => {
        const newSet = new Set(prev);
        newSet.delete(offerId);
        return newSet;
      });
      toast.success('Offer removed from saved');
    } catch (error) {
      toast.error('Failed to unsave offer');
    }
  };

  const filterOffers = () => {
    let filtered = offers;

    if (searchTerm) {
      filtered = filtered.filter(offer =>
        offer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        offer.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedStore) {
      filtered = filtered.filter(offer => offer.store === selectedStore);
    }

    if (selectedCategory) {
      filtered = filtered.filter(offer => offer.category === selectedCategory);
    }

    setFilteredOffers(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStore('');
    setSelectedCategory('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading amazing deals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4">
          Find the Best <span className="bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">Deals</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Discover amazing discounts from all major shopping sites in one place
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8" data-testid="search-filters">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <Input
              placeholder="Search offers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="search-input"
            />
          </div>
          <div>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger data-testid="store-filter">
                <SelectValue placeholder="All Stores" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(store => (
                  <SelectItem key={store} value={store}>{store}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={clearFilters} variant="outline" data-testid="clear-filters-button">
            Clear Filters
          </Button>
        </div>
        
        <div className="text-sm text-gray-600">
          Showing {filteredOffers.length} of {offers.length} offers
        </div>
      </div>

      {/* Offers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="offers-grid">
        {filteredOffers.map(offer => (
          <OfferCard
            key={offer.id}
            offer={offer}
            onSave={handleSaveOffer}
            onUnsave={handleUnsaveOffer}
            isSaved={savedOffers.has(offer.id)}
          />
        ))}
      </div>

      {filteredOffers.length === 0 && !loading && (
        <div className="text-center py-16" data-testid="no-offers-message">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No offers found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
          <Button onClick={clearFilters} data-testid="clear-filters-no-results">
            Clear All Filters
          </Button>
        </div>
      )}
    </div>
  );
};

// Admin Panel Component
const AdminPanel = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [offers, setOffers] = useState([]);
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/');
      return;
    }
    fetchStats();
    fetchOffers();
  }, [user, navigate]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to fetch stats');
    }
  };

  const fetchOffers = async () => {
    try {
      const response = await axios.get(`${API}/offers`);
      setOffers(response.data);
    } catch (error) {
      toast.error('Failed to fetch offers');
    }
  };

  const seedData = async () => {
    try {
      await axios.post(`${API}/admin/seed-data`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Sample data added successfully!');
      fetchOffers();
      fetchStats();
    } catch (error) {
      toast.error('Failed to seed data');
    }
  };

  const deleteOffer = async (offerId) => {
    try {
      await axios.delete(`${API}/offers/${offerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Offer deleted successfully');
      fetchOffers();
      fetchStats();
    } catch (error) {
      toast.error('Failed to delete offer');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8" data-testid="admin-panel">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Offers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{stats.total_offers || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Offers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.active_offers || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.total_users || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Saved Offers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.total_saved || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-8">
          <Dialog open={showAddOffer} onOpenChange={setShowAddOffer}>
            <DialogTrigger asChild>
              <Button data-testid="add-offer-button">Add New Offer</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <OfferForm 
                onClose={() => setShowAddOffer(false)} 
                onSuccess={() => { fetchOffers(); fetchStats(); }}
              />
            </DialogContent>
          </Dialog>
          
          <Button onClick={seedData} variant="outline" data-testid="seed-data-button">
            Seed Sample Data
          </Button>
        </div>

        {/* Offers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Manage Offers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {offers.map(offer => (
                <div key={offer.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <img src={offer.product_image} alt={offer.title} className="w-16 h-16 object-cover rounded" />
                    <div>
                      <h3 className="font-semibold">{offer.title}</h3>
                      <p className="text-sm text-gray-600">{offer.store} • {offer.category}</p>
                      <Badge className="mt-1">{offer.discount_percentage}% OFF</Badge>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Edit</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <OfferForm 
                          offer={offer}
                          onClose={() => {}}
                          onSuccess={() => { fetchOffers(); fetchStats(); }}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => deleteOffer(offer.id)}
                      data-testid="delete-offer-button"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Offer Form Component
const OfferForm = ({ offer, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    title: offer?.title || '',
    description: offer?.description || '',
    discount_percentage: offer?.discount_percentage || '',
    original_price: offer?.original_price || '',
    discounted_price: offer?.discounted_price || '',
    store: offer?.store || '',
    category: offer?.category || '',
    product_image: offer?.product_image || '',
    offer_link: offer?.offer_link || '',
    expiry_date: offer?.expiry_date ? new Date(offer.expiry_date).toISOString().split('T')[0] : ''
  });

  const stores = ['Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Meesho'];
  const categories = ['Electronics', 'Fashion', 'Home & Kitchen', 'Sports & Fitness', 'Books', 'Beauty'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      discount_percentage: parseInt(formData.discount_percentage),
      original_price: formData.original_price ? parseFloat(formData.original_price) : null,
      discounted_price: formData.discounted_price ? parseFloat(formData.discounted_price) : null,
      expiry_date: formData.expiry_date ? new Date(formData.expiry_date).toISOString() : null
    };

    try {
      if (offer) {
        await axios.put(`${API}/offers/${offer.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Offer updated successfully!');
      } else {
        await axios.post(`${API}/offers`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Offer created successfully!');
      }
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to save offer');
    }
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle>{offer ? 'Edit Offer' : 'Add New Offer'}</DialogTitle>
      </DialogHeader>
      
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>
          <div>
            <Label htmlFor="discount_percentage">Discount %</Label>
            <Input
              id="discount_percentage"
              type="number"
              value={formData.discount_percentage}
              onChange={(e) => setFormData({...formData, discount_percentage: e.target.value})}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="original_price">Original Price (₹)</Label>
            <Input
              id="original_price"
              type="number"
              step="0.01"
              value={formData.original_price}
              onChange={(e) => setFormData({...formData, original_price: e.target.value})}
            />
          </div>
          <div>
            <Label htmlFor="discounted_price">Discounted Price (₹)</Label>
            <Input
              id="discounted_price"
              type="number"
              step="0.01"
              value={formData.discounted_price}
              onChange={(e) => setFormData({...formData, discounted_price: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="store">Store</Label>
            <Select value={formData.store} onValueChange={(value) => setFormData({...formData, store: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map(store => (
                  <SelectItem key={store} value={store}>{store}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="product_image">Product Image URL</Label>
          <Input
            id="product_image"
            type="url"
            value={formData.product_image}
            onChange={(e) => setFormData({...formData, product_image: e.target.value})}
            required
          />
        </div>

        <div>
          <Label htmlFor="offer_link">Offer Link</Label>
          <Input
            id="offer_link"
            type="url"
            value={formData.offer_link}
            onChange={(e) => setFormData({...formData, offer_link: e.target.value})}
            required
          />
        </div>

        <div>
          <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
          <Input
            id="expiry_date"
            type="date"
            value={formData.expiry_date}
            onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {offer ? 'Update Offer' : 'Create Offer'}
          </Button>
        </div>
      </form>
    </div>
  );
};

// Saved Offers Component
const SavedOffers = () => {
  const [savedOffers, setSavedOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    fetchSavedOffers();
  }, [isAuthenticated, navigate]);

  const fetchSavedOffers = async () => {
    try {
      const response = await axios.get(`${API}/users/saved-offers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSavedOffers(response.data);
    } catch (error) {
      toast.error('Failed to fetch saved offers');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsaveOffer = async (offerId) => {
    try {
      await axios.delete(`${API}/offers/${offerId}/save`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSavedOffers(prev => prev.filter(offer => offer.id !== offerId));
      toast.success('Offer removed from saved');
    } catch (error) {
      toast.error('Failed to unsave offer');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your saved offers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" data-testid="saved-offers-page">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Saved Offers</h1>
      
      {savedOffers.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-gray-400 text-6xl mb-4">💾</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No saved offers yet</h3>
          <p className="text-gray-600 mb-4">Start saving offers you love!</p>
          <Button asChild>
            <Link to="/">Browse Offers</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {savedOffers.map(offer => (
            <OfferCard
              key={offer.id}
              offer={offer}
              onUnsave={handleUnsaveOffer}
              isSaved={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <main className="pb-16">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/saved" element={<SavedOffers />} />
              <Route path="/admin" element={<AdminPanel />} />
            </Routes>
          </main>
          
          {/* Footer */}
          <footer className="bg-white border-t mt-16">
            <div className="container mx-auto px-4 py-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">DH</span>
                    </div>
                    <span className="font-bold text-xl text-gray-900">DealHunt</span>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Find the best discounts from all major shopping sites in one place!
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Popular Stores</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>Amazon Offers</li>
                    <li>Flipkart Deals</li>
                    <li>Myntra Fashion</li>
                    <li>Ajio Collection</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Categories</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>Electronics</li>
                    <li>Fashion</li>
                    <li>Home & Kitchen</li>
                    <li>Beauty</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Support</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>Contact Us</li>
                    <li>About DealHunt</li>
                    <li>Privacy Policy</li>
                    <li>Terms of Service</li>
                  </ul>
                </div>
              </div>
              
              <div className="border-t pt-8 mt-8 text-center text-sm text-gray-600">
                <p>&copy; 2024 DealHunt. All rights reserved. Built with ❤️ for deal hunters.</p>
                <p className="mt-2 text-xs text-gray-500">Made by <span className="font-medium text-emerald-600">Aditya Chaudhari</span></p>
              </div>
            </div>
          </footer>
          
          <Toaster />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;