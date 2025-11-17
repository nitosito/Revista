import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Expenses from './pages/Expenses';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard/>} />
        <Route path="/products" element={<Products/>} />
        <Route path="/sales" element={<Sales/>} />
        <Route path="/expenses" element={<Expenses/>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
