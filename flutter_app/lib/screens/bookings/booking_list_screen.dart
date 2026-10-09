import 'package:flutter/material.dart';

class JobListScreen extends StatelessWidget {
  const JobListScreen({super.key});

  final List<Map<String, String>> jobs = const [
    {'title': 'Cleaning', 'location': 'Lusaka', 'budget': 'K 350'},
    {'title': 'Plumbing', 'location': 'Kitwe', 'budget': 'K 520'},
    {'title': 'Electrical', 'location': 'Ndola', 'budget': 'K 700'},
  ];

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: jobs.length,
      itemBuilder: (context, index) {
        final job = jobs[index];
        return Card(
          elevation: 2,
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            title: Text(job['title'] ?? 'Service'),
            subtitle: Text(job['location'] ?? 'Location'),
            trailing: Text(job['budget'] ?? 'K 0'),
            onTap: () {},
          ),
        );
      },
    );
  }
}
