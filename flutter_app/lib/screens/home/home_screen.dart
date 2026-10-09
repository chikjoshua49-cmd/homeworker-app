import 'package:flutter/material.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(
                decoration: const InputDecoration(labelText: 'First name'),
                validator: (value) => value == null || value.isEmpty ? 'First name required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                decoration: const InputDecoration(labelText: 'Last name'),
                validator: (value) => value == null || value.isEmpty ? 'Last name required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                decoration: const InputDecoration(labelText: 'Email'),
                validator: (value) => value == null || value.isEmpty ? 'Email required' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password'),
                validator: (value) => value == null || value.isEmpty ? 'Password required' : null,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () {
                  if (_formKey.currentState!.validate()) {
                    Navigator.of(context).pop();
                  }
                },
                child: const Text('Register'),
              )
            ],
          ),
        ),
      ),
    );
  }
}
